export const CATEGORIES = [
  "power_tools",
  "garden",
  "kitchen",
  "camping",
  "automotive",
  "cleaning",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  power_tools: "Power tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  automotive: "Automotive",
  cleaning: "Cleaning",
  other: "Other",
};

export const CONDITIONS = ["excellent", "good", "fair", "worn"] as const;

export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export const REQUEST_STATUSES = [
  "pending",
  "approved",
  "declined",
  "returned",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const AVAILABILITY = ["available", "on_loan", "reserved"] as const;

export type Availability = (typeof AVAILABILITY)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: "Available",
  on_loan: "On loan",
  reserved: "Reserved",
};

export const MAX_LOAN_DAYS = 30;
export const DAILY_REQUEST_LIMIT = 12;
export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const DESCRIPTION_MIN = 8;
export const DESCRIPTION_MAX = 400;
export const LISTING_CAP = 200;
export const MAX_HTTP_BODY = 16_000;
export const MIN_SECRET_LENGTH = 16;

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isCondition(value: string): value is Condition {
  return (CONDITIONS as readonly string[]).includes(value);
}

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}
