import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';
import type { IncomingMessage } from 'http';

type DocumentPropsWithNonce = DocumentInitialProps & { nonce?: string };

export default class MyDocument extends Document<DocumentPropsWithNonce> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentPropsWithNonce> {
    // Read the nonce set by middleware from request headers (edge/runtime compatible)
    // In Node runtime, ctx.req is available; in edge/app router, this may differ—but we're in pages router.
  const req = (ctx as { req?: IncomingMessage }).req;
  const hdrs = (req?.headers || {}) as Record<string, string | string[] | undefined>;
  const headerVal = hdrs['x-csp-nonce'];
  const nonce = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const initialProps = await Document.getInitialProps(ctx);
    // Attach nonce to initial props
    return { ...initialProps, nonce };
  }

  render() {
    const nonce: string | undefined = this.props.nonce;
    return (
      <Html lang="en">
        <Head>
          {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
          {/* Local fonts stylesheet is imported globally in _app.tsx (Next.js disallows <link rel="stylesheet"> here for local CSS). */}
          {/* Preload critical Inter weights to improve LCP */}
          <link rel="preload" href="/fonts/inter/Inter-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          <link rel="preload" href="/fonts/inter/Inter-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        </Head>
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
