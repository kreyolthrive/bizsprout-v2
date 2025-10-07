import type { AppProps } from "next/app";
import '../styles/theme.css';
import '../styles/landing.css';
import '../styles/fonts.css'; // self-hosted fonts (Inter, General Sans)

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
