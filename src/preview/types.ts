export type Category = { key: string; label: string };

export type PreviewBusiness = {
  slug: string;
  display_name: string;
  tagline: string;
  logo_url: string | null;
  hero_image_url: string | null;
  font_preset: "modern" | "editorial" | "rounded";
  design_preset: "mnc" | "normal" | "chatchat";
  colors: Record<string, string>;
  categories: Category[];
  reward_title: string;
  reward_threshold: number;
  source_url: string | null;
  status: "draft" | "ready";
};

export type PreviewMenuItem = {
  id: string;
  business_slug: string;
  category_key: string;
  section: string;
  title: string;
  description: string | null;
  price_cents: number;
  position: number;
};

export type PreviewCustomerRole = "customer" | "staff" | "manager";

export type PreviewCustomer = {
  id: string;
  business_slug: string;
  name: string;
  email: string;
  short_code: string;
  points: number;
  visits: number;
  role: PreviewCustomerRole;
  push_enabled: boolean;
  joined_at: string;
  last_visit_at: string | null;
};
