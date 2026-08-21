import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "SİLVAN CEBİMDE"
const SENDER_DOMAIN = "notify.uygulamamcebimde.online"
const ROOT_DOMAIN = "uygulamamcebimde.online"
const FROM_DOMAIN = "notify.uygulamamcebimde.online"
const SITE_URL = `https://${ROOT_DOMAIN}`

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const handler = createAuthEmailHandler({
          apiKey: process.env['LOVABLE_API_KEY']!,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          senderDomain: SENDER_DOMAIN,
          sendUrl: process.env['LOVABLE_SEND_URL'],
          emails: {
            signup: {
              subject: `${SITE_NAME} hesabınızı doğrulayın`,
              render: (data) =>
                React.createElement(SignupEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  recipient: data.email,
                  confirmationUrl: data.url,
                  token: data.token ?? '',
                }),
            },
            invite: {
              subject: "SofraKapımda ekibine davet edildiniz",
              render: (data) =>
                React.createElement(InviteEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  confirmationUrl: data.url,
                }),
            },
            magiclink: {
              subject: `${SITE_NAME} giriş kodunuz`,
              render: (data) =>
                React.createElement(MagicLinkEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                  token: data.token ?? '',
                }),
            },
            recovery: {
              subject: `${SITE_NAME} şifre sıfırlama`,
              render: (data) =>
                React.createElement(RecoveryEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                  token: data.token ?? '',
                }),
            },
            email_change: {
              subject: 'Yeni e-posta adresinizi onaylayın',
              render: (data) =>
                React.createElement(EmailChangeEmail, {
                  siteName: SITE_NAME,
                  oldEmail: data.old_email ?? '',
                  email: data.email,
                  newEmail: data.new_email ?? '',
                  confirmationUrl: data.url,
                  token: data.token ?? '',
                }),
            },
            reauthentication: {
              subject: `${SITE_NAME} doğrulama kodunuz`,
              render: (data) =>
                React.createElement(ReauthenticationEmail, { token: data.token ?? '', siteName: SITE_NAME }),
            },
          },
        })
        return handler(request)
      },
    },
  },
})
