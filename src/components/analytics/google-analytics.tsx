import Script from "next/script";

export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  if (measurementId == null || measurementId.trim() === "") {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            send_page_view: true,
            page_title: document.title,
            page_location: window.location.href,
            page_path: window.location.pathname + window.location.search
          });
        `}
      </Script>
    </>
  );
}
