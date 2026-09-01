export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
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
        Relationships: [];
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
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_id: string | null;
          security_name: string;
          isin: string | null;
          wkn: string | null;
          ticker: string | null;
          exchange: string | null;
          security_currency: string | null;
          asset_type: string | null;
          type: Database["public"]["Enums"]["transaction_type"];
          trade_date: string;
          settlement_date: string | null;
          quantity: number | null;
          unit_price: number | null;
          gross_amount: number | null;
          net_amount: number | null;
          currency: string;
          external_id: string | null;
          broker: string | null;
          source_document_id: string | null;
          import_run_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          security_id?: string | null;
          security_name: string;
          isin?: string | null;
          wkn?: string | null;
          ticker?: string | null;
          exchange?: string | null;
          security_currency?: string | null;
          asset_type?: string | null;
          type: Database["public"]["Enums"]["transaction_type"];
          trade_date: string;
          settlement_date?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          gross_amount?: number | null;
          net_amount?: number | null;
          currency: string;
          external_id?: string | null;
          broker?: string | null;
          source_document_id?: string | null;
          import_run_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          security_name?: string;
          isin?: string | null;
          wkn?: string | null;
          ticker?: string | null;
          exchange?: string | null;
          security_currency?: string | null;
          asset_type?: string | null;
          type?: Database["public"]["Enums"]["transaction_type"];
          trade_date?: string;
          settlement_date?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          gross_amount?: number | null;
          net_amount?: number | null;
          currency?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction_components: {
        Row: {
          id: string;
          transaction_id: string;
          component_type: Database["public"]["Enums"]["transaction_component_type"];
          amount: number;
          currency: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          component_type: Database["public"]["Enums"]["transaction_component_type"];
          amount: number;
          currency: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          component_type?: Database["public"]["Enums"]["transaction_component_type"];
          amount?: number;
          currency?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      manual_security_prices: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin: string | null;
          ticker: string | null;
          price: number;
          currency: string;
          price_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin?: string | null;
          ticker?: string | null;
          price: number;
          currency: string;
          price_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          security_name?: string;
          isin?: string | null;
          ticker?: string | null;
          price?: number;
          currency?: string;
          price_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_data_sync_runs: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_key: string | null;
          provider: string;
          provider_symbol: string | null;
          status: "processing" | "completed" | "completed_with_errors" | "failed";
          prices_imported: number;
          dividends_imported: number;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          security_key?: string | null;
          provider: string;
          provider_symbol?: string | null;
          status?: "processing" | "completed" | "completed_with_errors" | "failed";
          prices_imported?: number;
          dividends_imported?: number;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
          created_at?: string;
        };
        Update: {
          security_key?: string | null;
          provider?: string;
          provider_symbol?: string | null;
          status?: "processing" | "completed" | "completed_with_errors" | "failed";
          prices_imported?: number;
          dividends_imported?: number;
          error_message?: string | null;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      security_provider_symbols: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          provider: string;
          provider_symbol: string;
          source: "manual" | "derived" | "api_search" | "import" | "system";
          notes: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          provider: string;
          provider_symbol: string;
          source?: "manual" | "derived" | "api_search" | "import" | "system";
          notes?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_symbol?: string;
          source?: "manual" | "derived" | "api_search" | "import" | "system";
          notes?: string | null;
          resolved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_prices: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin: string | null;
          ticker: string | null;
          provider: string;
          provider_symbol: string;
          price_date: string;
          open_price: number | null;
          high_price: number | null;
          low_price: number | null;
          close_price: number;
          adjusted_close_price: number | null;
          volume: number | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin?: string | null;
          ticker?: string | null;
          provider: string;
          provider_symbol: string;
          price_date: string;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          close_price: number;
          adjusted_close_price?: number | null;
          volume?: number | null;
          currency: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          security_name?: string;
          isin?: string | null;
          ticker?: string | null;
          provider_symbol?: string;
          price_date?: string;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          close_price?: number;
          adjusted_close_price?: number | null;
          volume?: number | null;
          currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_dividends: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin: string | null;
          ticker: string | null;
          provider: string;
          provider_symbol: string;
          ex_dividend_date: string;
          declaration_date: string | null;
          record_date: string | null;
          payment_date: string | null;
          amount_per_share: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin?: string | null;
          ticker?: string | null;
          provider: string;
          provider_symbol: string;
          ex_dividend_date: string;
          declaration_date?: string | null;
          record_date?: string | null;
          payment_date?: string | null;
          amount_per_share: number;
          currency: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          security_name?: string;
          isin?: string | null;
          ticker?: string | null;
          provider_symbol?: string;
          ex_dividend_date?: string;
          declaration_date?: string | null;
          record_date?: string | null;
          payment_date?: string | null;
          amount_per_share?: number;
          currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      securities: {
        Row: {
          id: string;
          name: string;
          isin: string | null;
          wkn: string | null;
          ticker: string | null;
          exchange: string | null;
          currency: string | null;
          asset_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          isin?: string | null;
          wkn?: string | null;
          ticker?: string | null;
          exchange?: string | null;
          currency?: string | null;
          asset_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          isin?: string | null;
          wkn?: string | null;
          ticker?: string | null;
          exchange?: string | null;
          currency?: string | null;
          asset_type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      user_securities: {
        Row: {
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin: string | null;
          wkn: string | null;
          ticker: string | null;
          exchange: string | null;
          security_currency: string | null;
          asset_type: string | null;
          transaction_count: number;
          first_trade_date: string;
          last_trade_date: string;
        };
        Relationships: [];
      };
      latest_market_prices: {
        Row: {
          id: string;
          user_id: string;
          portfolio_id: string;
          security_key: string;
          security_name: string;
          isin: string | null;
          ticker: string | null;
          provider: string;
          provider_symbol: string;
          price_date: string;
          close_price: number;
          adjusted_close_price: number | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
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
