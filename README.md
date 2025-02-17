# Podcasty

Podcasty is in the super early stages, but my goal is to build a simple and
easy-to-use podcast self-hosting platform that allows you to upload episodes,
import existing podcasts, and more. It serves as a custom backend for your
podcast website. With it, you'll be able to spin up an OpenAI Whisper client and
auto-transcribe your episodes. You'll also be able to use whatever object store
you want.

All of this data is available to be queried from GraphQL to your podcast
frontend, so you have total freedom to do whatever you want. It's completely
headless.

## The Inspiration

I was tired of paying over $100 a year for hosting a podcast that I don't
frequently upload to. But I still love this hobby, so I didn't want to
completely drop it. I was looking at other self-hosted options, and the
landscape is a bit bleak, especially if you don't want to spend a huge amount of
time setting something up. I was looking at [Castopod](https://castopod.org/)
back in the day, and I could never get it to run.

## What's The Stack?

We are using the [Epic Stack](https://github.com/epicweb-dev/epic-stack). This
made the starting point a lot easier. I am also using
[Shadcn](https://ui.shadcn.com/) for the UI because I think it looks a lot nicer
than the standard [Radix UI](https://www.radix-ui.com/) theme.
