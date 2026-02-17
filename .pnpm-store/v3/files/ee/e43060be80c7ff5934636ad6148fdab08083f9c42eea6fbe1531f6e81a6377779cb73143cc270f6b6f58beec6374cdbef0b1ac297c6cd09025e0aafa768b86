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
type AllowedPropertyValues = string | number | boolean | null;
type BeforeSend = (event: BeforeSendEvent) => BeforeSendEvent | null;
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
type PlainFlags = Record<string, unknown>;
type FlagsDataInput = (string | PlainFlags)[] | PlainFlags;

type HeadersObject = Record<string, string | string[] | undefined>;
type AllowedHeaders = Headers | HeadersObject;
interface Options {
    flags?: FlagsDataInput;
    headers?: AllowedHeaders;
    request?: {
        headers: AllowedHeaders;
    };
}
declare function track(eventName: string, properties?: Record<string, AllowedPropertyValues>, options?: Options): Promise<void>;

export { track };
