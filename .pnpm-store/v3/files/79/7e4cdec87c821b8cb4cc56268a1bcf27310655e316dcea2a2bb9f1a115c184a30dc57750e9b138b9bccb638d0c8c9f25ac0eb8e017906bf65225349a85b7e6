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
type PlainFlags = Record<string, unknown>;
type FlagsDataInput = (string | PlainFlags)[] | PlainFlags;

/**
 * Tracks a custom event. Please refer to the [documentation](https://vercel.com/docs/concepts/analytics/custom-events) for more information on custom events.
 * @param name - The name of the event.
 * * Examples: `Purchase`, `Click Button`, or `Play Video`.
 * @param [properties] - Additional properties of the event. Nested objects are not supported. Allowed values are `string`, `number`, `boolean`, and `null`.
 */
declare function track(name: string, properties?: Record<string, AllowedPropertyValues>, options?: {
    flags?: FlagsDataInput;
}): void;

declare function injectAnalytics(props?: Omit<AnalyticsProps, 'framework'>): void;

export { type AnalyticsProps, type BeforeSend, type BeforeSendEvent, injectAnalytics, track };
