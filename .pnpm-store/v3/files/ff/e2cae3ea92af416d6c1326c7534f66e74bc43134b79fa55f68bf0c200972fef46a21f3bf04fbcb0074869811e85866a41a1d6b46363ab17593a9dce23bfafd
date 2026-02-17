interface PageViewEvent {
    type: 'pageview';
    url: string;
}
interface CustomEvent {
    type: 'event';
    url: string;
}
type BeforeSendEvent = PageViewEvent | CustomEvent;
type Mode = 'auto' | 'development' | 'production';
type BeforeSend = (event: BeforeSendEvent) => BeforeSendEvent | null;
interface AnalyticsProps {
    beforeSend?: BeforeSend;
    debug?: boolean;
    mode?: Mode;
    scriptSrc?: string;
    endpoint?: string;
    dsn?: string;
}
declare global {
    interface Window {
        va?: (event: 'beforeSend' | 'event' | 'pageview', properties?: unknown) => void;
        vaq?: [string, unknown?][];
        vai?: boolean;
        vam?: Mode;
        /** used by Astro component only */
        webAnalyticsBeforeSend?: BeforeSend;
    }
}

declare function Analytics(props: Omit<AnalyticsProps, 'route'>): JSX.Element;

export { Analytics, type AnalyticsProps, type BeforeSend, type BeforeSendEvent };
