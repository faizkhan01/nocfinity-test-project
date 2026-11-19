<?php

namespace App\Mail\Transport;

use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\RawMessage;

/**
 * Sends to real inboxes through one transport and to placeholder addresses (demo accounts on
 * .test or example.com) through another, e.g. Brevo and the Mailpit demo inbox.
 */
class RecipientRoutingTransport implements TransportInterface
{
    /** @param list<string> $placeholderDomains domains or TLDs that can never receive mail */
    public function __construct(
        private readonly TransportInterface $deliverable,
        private readonly TransportInterface $placeholder,
        private readonly array $placeholderDomains,
    ) {}

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        $envelope ??= Envelope::create($message);
        [$fake, $real] = collect($envelope->getRecipients())->partition(fn (Address $address) => $this->isPlaceholder($address));

        $sent = null;
        foreach ([[$real, $this->deliverable], [$fake, $this->placeholder]] as [$recipients, $transport]) {
            if ($recipients->isNotEmpty()) {
                $sent = $transport->send($message, new Envelope($envelope->getSender(), $recipients->values()->all()));
            }
        }

        return $sent;
    }

    public function isPlaceholder(Address $address): bool
    {
        $domain = strtolower(substr(strrchr($address->getAddress(), '@') ?: '', 1));

        foreach ($this->placeholderDomains as $placeholder) {
            if ($domain === $placeholder || str_ends_with($domain, '.'.$placeholder)) {
                return true;
            }
        }

        return false;
    }

    public function __toString(): string
    {
        return "routed({$this->deliverable}, {$this->placeholder})";
    }
}
