export interface Vessel {
  id: number;
  name: string;
  imo_number: string | null;
  max_weight: number;
  max_volume: number | null;
  draft: number | null;
  route: string | null;
  capacity_20ft: number | null;
  capacity_40ft: number | null;
  status: string;
  created_at: string;
}

export interface CargoOrder {
  id: number;
  order_no: string;
  customer_name: string;
  customer_contact: string | null;
  cargo_name: string;
  cargo_type: string | null;
  weight: number;
  volume: number | null;
  container_type: string | null;
  container_count: number;
  is_dangerous: number;
  dangerous_category: string | null;
  un_number: string | null;
  origin_port: string;
  destination_port: string;
  delivery_deadline: string | null;
  special_requirements: string | null;
  status: string;
  created_at: string;
}

export interface TideWindow {
  id: number;
  port_name: string;
  date: string;
  high_tide_start: string;
  high_tide_end: string;
  max_draft: number | null;
  notes: string;
}

export interface DangerousGoodsRule {
  id: number;
  category_a: string;
  category_b: string;
  conflict_level: string;
  rule_description: string;
  created_at?: string;
}

export interface ConflictItem {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  involvedOrders?: number[];
}

export interface ValidationSummary {
  totalWeight: number;
  totalVolume: number;
  container20ft: number;
  container40ft: number;
  weightUtilization: number;
  volumeUtilization: number;
  dangerousCount: number;
}

export interface ValidationResult {
  valid: boolean;
  conflicts: ConflictItem[];
  warnings: ConflictItem[];
  summary: ValidationSummary;
}

export interface StowagePlan {
  id: number;
  plan_no: string;
  vessel_id: number;
  voyage_no: string | null;
  etd: string | null;
  eta: string | null;
  origin_port: string | null;
  destination_port: string | null;
  tide_window_id: number | null;
  total_weight: number;
  total_volume: number;
  status: string;
  captain_confirmed: number;
  captain_name: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  vessel_name?: string;
  imo_number?: string;
  vessel?: Vessel;
  tide_window?: TideWindow;
  items?: any[];
  conflict_reports?: any[];
}

export interface Stats {
  totalVessels: number;
  pendingOrders: number;
  draftPlans: number;
  confirmedPlans: number;
  todayTides: number;
  dangerousOrders: number;
}
