export type Cafe = {
    /** Internal store key (auto-generated, never shown to user) */
    id: string;
    /** Display name for this cafe */
    name: string;
    /** Numeric Cafe ID used in iCafeCloud API URLs (e.g. 87127) */
    cafeId: string;
    /** Bearer token / API key for this cafe */
    apiKey: string;
};
