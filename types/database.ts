export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          base_currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          base_currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          base_currency?: string;
          updated_at?: string;
        };
      };
      portfolios: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          base_currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          base_currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          base_currency?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_type: "buy" | "sell" | "dividend" | "fee" | "tax";
      transaction_component_type:
        | "fee"
        | "tax"
        | "withholding_tax"
        | "exchange_fee"
        | "broker_fee"
        | "other";
      import_status:
        | "pending"
        | "processing"
        | "completed"
        | "completed_with_errors"
        | "failed";
      source_type:
        | "manual"
        | "csv"
        | "comdirect"
        | "trade_republic"
        | "interactive_brokers";
      source_document_type:
        | "csv"
        | "broker_statement"
        | "postbox_document"
        | "manual_entry"
        | "api_payload";
      import_row_status: "pending" | "imported" | "skipped" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};

