import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function RootHtml({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#F7F6FB" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#121116" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Pocket Plan" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
        <link rel="manifest" href="manifest.webmanifest" />
        <title>Pocket Plan</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --pocket-plan-background: #F7F6FB;
            --pocket-plan-nav-background: #FFFFFF;
            --pocket-plan-accent: #635BFF;
            color-scheme: light dark;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --pocket-plan-background: #121116;
              --pocket-plan-nav-background: #1B1921;
              --pocket-plan-accent: #8C84FF;
            }
          }
          html {
            width: 100%;
            height: 100%;
            min-height: 100%;
            margin: 0;
            overflow: hidden;
            overscroll-behavior: none;
            background: var(--pocket-plan-nav-background);
          }
          body {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100dvh;
            min-height: 100dvh;
            max-height: 100dvh;
            margin: 0;
            overflow: hidden;
            overscroll-behavior: none;
            background: var(--pocket-plan-nav-background);
          }
          body, #root, body > div:first-of-type {
            box-sizing: border-box;
            max-width: 100%;
          }
          #root, body > div:first-of-type {
            width: 100%;
            height: 100%;
            min-width: 0;
            min-height: 0;
            max-height: 100%;
            overflow: hidden;
            background: var(--pocket-plan-background);
            padding-top: env(safe-area-inset-top);
            padding-right: env(safe-area-inset-right);
            padding-bottom: 0;
            padding-left: env(safe-area-inset-left);
          }
          *, *::before, *::after { box-sizing: border-box; }
          #root input, #root textarea, #root select, #root button {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            max-width: 100%;
          }
          #root input:focus, #root textarea:focus {
            outline: 2px solid var(--pocket-plan-accent);
            outline-offset: -2px;
          }
          [data-testid="pocket-plan-amount-wrap"] {
            width: 100%;
            min-width: 0;
            max-width: 100%;
            overflow: hidden;
          }
          [data-testid="pocket-plan-amount-input"] {
            width: 0 !important;
            min-width: 0 !important;
            max-width: 100% !important;
            flex: 1 1 0% !important;
          }
          [data-testid="pocket-plan-amount-input"]:focus { outline: none !important; }
          [data-testid="pocket-plan-amount-wrap"]:focus-within {
            border-color: var(--pocket-plan-accent) !important;
            box-shadow: inset 0 0 0 1px var(--pocket-plan-accent);
          }
          [data-testid="pocket-plan-bottom-nav"] {
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            height: calc(72px + env(safe-area-inset-bottom)) !important;
            min-height: calc(72px + env(safe-area-inset-bottom)) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
          }
        ` }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
