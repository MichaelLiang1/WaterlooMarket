import type {
  Category,
  Condition,
  ListingKind,
  ListingStatus,
  PriceUnit,
  RequestStatus,
} from "@/generated/prisma/enums";

export const KIND_LABELS: Record<ListingKind, string> = {
  SALE: "For sale",
  RENT: "For rent",
  STORAGE: "Storage offered",
  WANTED: "Wanted",
  SUBLET: "Sublet",
};

export const KIND_DESCRIPTIONS: Record<ListingKind, string> = {
  SALE: "Sell something outright.",
  RENT: "Lend an item for specific dates.",
  STORAGE: "Offer to store someone's things while they're away.",
  WANTED: "Post what you're looking for.",
  SUBLET: "Share a sublet in Waterloo or a work-term city.",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  FURNITURE: "Furniture",
  APPLIANCES: "Appliances",
  BIKES: "Bikes",
  ELECTRONICS: "Electronics",
  KITCHEN: "Kitchen",
  TEXTBOOKS: "Textbooks",
  CLOTHING: "Clothing",
  BEDDING: "Bedding",
  DECOR: "Decor",
  SPORTS: "Sports & outdoors",
  STORAGE_SPACE: "Storage space",
  HOUSING: "Housing",
  OTHER: "Other",
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: "New",
  GOOD: "Good",
  WORN: "Worn",
};

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  FLAT: "",
  PER_DAY: "/ day",
  PER_WEEK: "/ week",
  PER_MONTH: "/ month",
  PER_TERM: "/ term",
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: "Active",
  RESERVED: "Reserved",
  SOLD: "Sold",
  UNAVAILABLE: "Unavailable",
  REMOVED: "Removed",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

/** Kinds that are booked for date ranges rather than bought outright. */
export const DATED_KINDS: ListingKind[] = ["RENT", "STORAGE"];
/** Kinds that people can send a request on. */
export const REQUESTABLE_KINDS: ListingKind[] = ["SALE", "RENT", "STORAGE"];

/** General pickup areas; deliberately not exact addresses. */
export const NEIGHBOURHOODS = [
  "Near campus (Columbia / Phillip)",
  "Northdale",
  "Uptown Waterloo",
  "Lakeshore",
  "Beechwood",
  "Laurier area",
  "University Plaza",
  "Downtown Kitchener",
  "Village 1 (V1)",
  "Ron Eydt Village (REV)",
  "Mackenzie King Village (MKV)",
  "UW Place (UWP)",
  "Claudette Millar Hall (CMH)",
  "Columbia Lake Village (CLV)",
  "Minota Hagey",
  "Affiliated colleges",
  "Other Waterloo",
] as const;

/** Common co-op destinations, for sublet cross-listings. */
export const WORK_TERM_CITIES = [
  "Waterloo",
  "Toronto",
  "Ottawa",
  "Montreal",
  "Vancouver",
  "Calgary",
  "San Francisco Bay Area",
  "Seattle",
  "New York",
  "Other",
] as const;

export const REPORT_REASONS = [
  "Scam or fraud",
  "Prohibited item",
  "Spam or duplicate",
  "Offensive content",
  "Harassment",
  "Other",
] as const;

export const LISTING_TTL_DAYS = 30;
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
