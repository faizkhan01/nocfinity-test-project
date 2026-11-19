<?php

namespace Tests\Feature;

use App\Mail\Transport\RecipientRoutingTransport;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Address;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Tests\TestCase;

class MailTransportTest extends TestCase
{
    public function test_real_inboxes_and_demo_addresses_go_through_different_mailers(): void
    {
        config([
            'mail.mailers.real' => ['transport' => 'array'],
            'mail.mailers.demo' => ['transport' => 'array'],
            'mail.mailers.routed' => ['transport' => 'routed', 'deliverable' => 'real', 'placeholder' => 'demo'],
        ]);

        Mail::mailer('routed')->raw('Hello', fn (Message $m) => $m->to('jane@gmail.com')->subject('Real'));
        Mail::mailer('routed')->raw('Hello', fn (Message $m) => $m->to('customer@nocfinity-shop.test')->subject('Demo'));
        Mail::mailer('routed')->raw('Hello', fn (Message $m) => $m->to(['sam@outlook.com', 'buyer@example.com'])->subject('Both'));

        $this->assertSame(['jane@gmail.com', 'sam@outlook.com'], $this->recipients('real'));
        $this->assertSame(['customer@nocfinity-shop.test', 'buyer@example.com'], $this->recipients('demo'));
    }

    public function test_only_reserved_domains_count_as_placeholders(): void
    {
        $transport = Mail::mailer('array')->getSymfonyTransport();
        $router = new RecipientRoutingTransport($transport, $transport, config('mail.placeholder_domains'));

        $this->assertTrue($router->isPlaceholder(new Address('Demo@Shop.Example.COM')));
        $this->assertTrue($router->isPlaceholder(new Address('a@nocfinity-shop.test')));
        $this->assertFalse($router->isPlaceholder(new Address('a@test.com')), 'test.com is a real domain');
        $this->assertFalse($router->isPlaceholder(new Address('a@gmail.com')));
    }

    public function test_brevo_sends_through_its_http_api_with_the_api_key(): void
    {
        $requests = [];
        $this->app->instance(HttpClientInterface::class, new MockHttpClient(function (string $method, string $url, array $options) use (&$requests) {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse('{"messageId":"<1@smtp-relay.brevo.com>"}', ['http_code' => 201]);
        }));
        config(['mail.mailers.brevo.key' => 'xkeysib-test', 'mail.from' => ['address' => 'orders@shop.example', 'name' => 'SHOP.CO']]);

        Mail::mailer('brevo')->raw('Your order is confirmed.', fn (Message $m) => $m->to('jane@gmail.com', 'Jane')->subject('Order confirmed'));

        $this->assertCount(1, $requests);
        $this->assertSame('POST', $requests[0]['method']);
        $this->assertSame('https://api.brevo.com/v3/smtp/email', $requests[0]['url']);
        $this->assertContains('api-key: xkeysib-test', $requests[0]['options']['headers']);
        $payload = json_decode($requests[0]['options']['body'], true);
        $this->assertEquals([['name' => 'Jane', 'email' => 'jane@gmail.com']], $payload['to']);
        $this->assertEquals(['name' => 'SHOP.CO', 'email' => 'orders@shop.example'], $payload['sender']);
        $this->assertSame('Order confirmed', $payload['subject']);
    }

    public function test_brevo_without_an_api_key_fails_with_a_clear_message(): void
    {
        config(['mail.mailers.brevo.key' => null]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('BREVO_API_KEY');

        Mail::mailer('brevo')->getSymfonyTransport();
    }

    /** @return list<string> */
    private function recipients(string $mailer): array
    {
        return Mail::mailer($mailer)->getSymfonyTransport()->messages()
            ->flatMap(fn (SentMessage $sent) => array_map(fn (Address $a) => $a->getAddress(), $sent->getEnvelope()->getRecipients()))
            ->values()->all();
    }
}
