---
title: Self-Hosting Ansora on a $5 VPS
slug: self-hosting-on-a-vps
date: 2026-07-25T08:30:00.000Z
excerpt: A draft walkthrough of running Ansora in Docker on a small VPS — the exact compose file, volume setup, and the git-backed content directory.
tags:
  - self-hosting
  - docker
published: false
focusKeyword: self-host a blog
---

> This post is a **draft** — it exists so you can see how drafts behave. It is saved as markdown, committed to git, and only appears on the public site once you toggle *Published* in the editor.

A five-dollar VPS is more than enough to run a blog. Ansora's Docker image ships the whole stack, and because content lives in a mounted volume, your posts survive container rebuilds and even full redeploys.

## The one-file setup

```yaml
# docker-compose.yml
services:
  ansora:
    image: your-username/ansora:latest
    ports:
      - "3000:3000"
    environment:
      DEPLOYMENT_MODE: self-hosted
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD_HASH: ${ADMIN_PASSWORD_HASH}
      JWT_SECRET: ${JWT_SECRET}
      CONTENT_DIR: /app/content
    volumes:
      - ./content:/app/content
    restart: unless-stopped
```

## Why the volume matters

The `/app/content` volume holds your posts and site config. On first write, Ansora initializes it as its own git repository, so every autosave is a commit you can push to a remote whenever you like — instant backup, zero extra tooling.

## Backup story

Backing up a blog running on a VPS used to mean dumping a database. With Ansora it means one command on any machine:

```bash
git clone git@github.com:you/your-content.git
```

If the VPS dies, clone the content, point a fresh container at it, and you're back online.

## What's missing here

The full walkthrough — DNS, reverse proxy with Caddy, TLS, and the webhook story for serverless — lands soon. For now, the README in the repo covers all three deployment targets in detail.
