export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          mode: "investment" | "swing" | "daytrade" | "scalp" | null;
          equity: number;
          learn_mode: boolean;
          discipline_profile: "strict" | "balanced" | "expert";
          peak_equity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          mode?: "investment" | "swing" | "daytrade" | "scalp" | null;
          equity?: number;
          learn_mode?: boolean;
          discipline_profile?: "strict" | "balanced" | "expert";
          peak_equity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          mode?: "investment" | "swing" | "daytrade" | "scalp" | null;
          equity?: number;
          learn_mode?: boolean;
          discipline_profile?: "strict" | "balanced" | "expert";
          peak_equity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          strategy_id: string | null;
          strategy_version_id: string | null;
          strategy_name: string | null;
          strategy_snapshot: Json | null;
          ticker: string;
          direction: "LONG" | "SHORT";
          asset_class: string;
          mode: "investment" | "swing" | "daytrade" | "scalp";
          setup_types: string[];
          conditions: string[];
          chart_pattern: string;
          thesis: string;
          catalyst_window: string | null;
          invalidation: string;
          scores: Json;
          notes: Json;
          f_score: number;
          t_score: number;
          f_total: number;
          t_total: number;
          conviction: "MAX" | "HIGH" | "STD" | null;
          risk_pct: number | null;
          entry_price: number | null;
          stop_loss: number | null;
          shares: number;
          tranche1_shares: number;
          tranche2_shares: number;
          tranche2_filled: boolean;
          tranche2_deadline: string | null;
          exit_t1: boolean;
          exit_t2: boolean;
          exit_t3: boolean;
          exit_price: number | null;
          r2_target: number | null;
          r4_target: number | null;
          market_price: number | null;
          source: "thesis" | "marketwatch";
          state: "initiated" | "evaluated" | "blocked" | "deployed" | "overridden" | "closed";
          classification: "in_policy" | "override" | "out_of_bounds";
          confirmed: boolean;
          closed: boolean;
          closed_at: string | null;
          closed_reason: string | null;
          journal_entry: string;
          journal_exit: string;
          journal_post: string;
          insight: Json | null;
          created_at: string;
          updated_at: string;
          // V4 columns (migration 015)
          lineage_draft_id: string | null;
          next_parameter_check_at: string | null;
          last_parameter_check_at: string | null;
          last_parameter_check_result: Json | null;
          firm_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          strategy_id?: string | null;
          strategy_version_id?: string | null;
          strategy_name?: string | null;
          strategy_snapshot?: Json | null;
          ticker: string;
          direction: "LONG" | "SHORT";
          asset_class?: string;
          mode: "investment" | "swing" | "daytrade" | "scalp";
          setup_types?: string[];
          conditions?: string[];
          chart_pattern?: string;
          thesis: string;
          catalyst_window?: string | null;
          invalidation: string;
          scores?: Json;
          notes?: Json;
          f_score?: number;
          t_score?: number;
          f_total?: number;
          t_total?: number;
          conviction?: "MAX" | "HIGH" | "STD" | null;
          risk_pct?: number | null;
          entry_price?: number | null;
          stop_loss?: number | null;
          shares?: number;
          tranche1_shares?: number;
          tranche2_shares?: number;
          tranche2_filled?: boolean;
          tranche2_deadline?: string | null;
          exit_t1?: boolean;
          exit_t2?: boolean;
          exit_t3?: boolean;
          exit_price?: number | null;
          r2_target?: number | null;
          r4_target?: number | null;
          market_price?: number | null;
          source?: "thesis" | "marketwatch";
          state?: "initiated" | "evaluated" | "blocked" | "deployed" | "overridden" | "closed";
          classification?: "in_policy" | "override" | "out_of_bounds";
          confirmed?: boolean;
          closed?: boolean;
          closed_at?: string | null;
          closed_reason?: string | null;
          journal_entry?: string;
          journal_exit?: string;
          journal_post?: string;
          insight?: Json | null;
          created_at?: string;
          updated_at?: string;
          lineage_draft_id?: string | null;
          next_parameter_check_at?: string | null;
          last_parameter_check_at?: string | null;
          last_parameter_check_result?: Json | null;
          firm_id?: string | null;
        };
        Update: {
          strategy_id?: string | null;
          strategy_version_id?: string | null;
          strategy_name?: string | null;
          strategy_snapshot?: Json | null;
          ticker?: string;
          direction?: "LONG" | "SHORT";
          asset_class?: string;
          mode?: "investment" | "swing" | "daytrade" | "scalp";
          setup_types?: string[];
          conditions?: string[];
          chart_pattern?: string;
          thesis?: string;
          catalyst_window?: string | null;
          invalidation?: string;
          scores?: Json;
          notes?: Json;
          f_score?: number;
          t_score?: number;
          f_total?: number;
          t_total?: number;
          conviction?: "MAX" | "HIGH" | "STD" | null;
          risk_pct?: number | null;
          entry_price?: number | null;
          stop_loss?: number | null;
          shares?: number;
          tranche1_shares?: number;
          tranche2_shares?: number;
          tranche2_filled?: boolean;
          tranche2_deadline?: string | null;
          exit_t1?: boolean;
          exit_t2?: boolean;
          exit_t3?: boolean;
          exit_price?: number | null;
          r2_target?: number | null;
          r4_target?: number | null;
          market_price?: number | null;
          source?: "thesis" | "marketwatch";
          state?: "initiated" | "evaluated" | "blocked" | "deployed" | "overridden" | "closed";
          classification?: "in_policy" | "override" | "out_of_bounds";
          confirmed?: boolean;
          closed?: boolean;
          closed_at?: string | null;
          closed_reason?: string | null;
          journal_entry?: string;
          journal_exit?: string;
          journal_post?: string;
          insight?: Json | null;
          updated_at?: string;
          lineage_draft_id?: string | null;
          next_parameter_check_at?: string | null;
          last_parameter_check_at?: string | null;
          last_parameter_check_result?: Json | null;
          firm_id?: string | null;
        };
        Relationships: [];
      };
      overrides: {
        Row: {
          id: string;
          trade_id: string;
          user_id: string;
          rules_broken: string[];
          justification: string;
          quality_flag: "valid" | "low_quality" | "high_risk";
          ai_audit: Json | null;
          timer_duration_sec: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          trade_id: string;
          user_id: string;
          rules_broken?: string[];
          justification: string;
          quality_flag?: "valid" | "low_quality" | "high_risk";
          ai_audit?: Json | null;
          timer_duration_sec?: number;
          created_at?: string;
        };
        Update: {
          rules_broken?: string[];
          justification?: string;
          quality_flag?: "valid" | "low_quality" | "high_risk";
          ai_audit?: Json | null;
        };
        Relationships: [];
      };
      discipline_metrics: {
        Row: {
          id: string;
          user_id: string;
          strategy_id: string | null;
          score: number;
          period: string;
          in_policy_count: number;
          override_count: number;
          oob_count: number;
          pnl_in_policy: number;
          pnl_override: number;
          pnl_oob: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          strategy_id?: string | null;
          score?: number;
          period: string;
          in_policy_count?: number;
          override_count?: number;
          oob_count?: number;
          pnl_in_policy?: number;
          pnl_override?: number;
          pnl_oob?: number;
          created_at?: string;
        };
        Update: {
          strategy_id?: string | null;
          score?: number;
          period?: string;
          in_policy_count?: number;
          override_count?: number;
          oob_count?: number;
          pnl_in_policy?: number;
          pnl_override?: number;
          pnl_oob?: number;
        };
        Relationships: [];
      };
      user_metrics: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          strategy_id: string | null;
          metric_id: string;
          metric_type: "fundamental" | "technical";
          name: string;
          description: string | null;
          category: string | null;
          enabled: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: string;
          strategy_id?: string | null;
          metric_id: string;
          metric_type: "fundamental" | "technical";
          name: string;
          description?: string | null;
          category?: string | null;
          enabled?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          mode?: string;
          strategy_id?: string | null;
          metric_id?: string;
          metric_type?: "fundamental" | "technical";
          name?: string;
          description?: string | null;
          category?: string | null;
          enabled?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      watchlist_items: {
        Row: {
          id: string;
          user_id: string;
          strategy_id: string | null;
          strategy_version_id: string | null;
          strategy_name: string | null;
          strategy_snapshot: Json | null;
          ticker: string;
          direction: "LONG" | "SHORT";
          asset_class: string | null;
          mode: string;
          scores: Json | null;
          verdict: string | null;
          note: string | null;
          last_scored_at: string | null;
          flagged_at: string;
          source: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          strategy_id?: string | null;
          strategy_version_id?: string | null;
          strategy_name?: string | null;
          strategy_snapshot?: Json | null;
          ticker: string;
          direction: "LONG" | "SHORT";
          asset_class?: string | null;
          mode: string;
          scores?: Json | null;
          verdict?: string | null;
          note?: string | null;
          last_scored_at?: string | null;
          flagged_at?: string;
          source?: string | null;
        };
        Update: {
          strategy_id?: string | null;
          strategy_version_id?: string | null;
          strategy_name?: string | null;
          strategy_snapshot?: Json | null;
          ticker?: string;
          direction?: "LONG" | "SHORT";
          asset_class?: string | null;
          mode?: string;
          scores?: Json | null;
          verdict?: string | null;
          note?: string | null;
          last_scored_at?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      user_trade_structure_items: {
        Row: {
          id: string;
          user_id: string;
          item_type: "setup_type" | "condition" | "chart_pattern";
          setup_category: "fundamental" | "technical" | null;
          label: string;
          family: string;
          detail: string;
          keywords: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type: "setup_type" | "condition" | "chart_pattern";
          setup_category?: "fundamental" | "technical" | null;
          label: string;
          family?: string;
          detail?: string;
          keywords?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          item_type?: "setup_type" | "condition" | "chart_pattern";
          setup_category?: "fundamental" | "technical" | null;
          label?: string;
          family?: string;
          detail?: string;
          keywords?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_strategies: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          name: string;
          description: string;
          learning_goal: string | null;
          ai_instruction: string | null;
          status: "draft" | "active" | "archived";
          preset_key: string | null;
          is_preset_clone: boolean;
          is_default: boolean;
          active_version_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: string;
          name: string;
          description?: string;
          learning_goal?: string | null;
          ai_instruction?: string | null;
          status?: "draft" | "active" | "archived";
          preset_key?: string | null;
          is_preset_clone?: boolean;
          is_default?: boolean;
          active_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          mode?: string;
          name?: string;
          description?: string;
          learning_goal?: string | null;
          ai_instruction?: string | null;
          status?: "draft" | "active" | "archived";
          preset_key?: string | null;
          is_preset_clone?: boolean;
          is_default?: boolean;
          active_version_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      strategy_versions: {
        Row: {
          id: string;
          strategy_id: string;
          version_number: number;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          strategy_id: string;
          version_number: number;
          snapshot?: Json;
          created_at?: string;
        };
        Update: {
          version_number?: number;
          snapshot?: Json;
        };
        Relationships: [];
      };
      // ---------------------------------------------------------------
      // V4 workflow spine tables (migration 015)
      // ---------------------------------------------------------------
      trade_drafts: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          direction: "LONG" | "SHORT" | null;
          mode: string | null;
          strategy_id: string | null;
          state: "observed" | "qualified" | "planned" | "ready" | "deployed" | "archived";
          draft_context: Json;
          intake_fields: Json;
          blockers: Json;
          plan: Json;
          challenge_result: Json | null;
          parent_draft_id: string | null;
          deployed_trade_id: string | null;
          firm_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker?: string;
          direction?: "LONG" | "SHORT" | null;
          mode?: string | null;
          strategy_id?: string | null;
          state?: "observed" | "qualified" | "planned" | "ready" | "deployed" | "archived";
          draft_context?: Json;
          intake_fields?: Json;
          blockers?: Json;
          plan?: Json;
          challenge_result?: Json | null;
          parent_draft_id?: string | null;
          deployed_trade_id?: string | null;
          firm_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          ticker?: string;
          direction?: "LONG" | "SHORT" | null;
          mode?: string | null;
          strategy_id?: string | null;
          state?: "observed" | "qualified" | "planned" | "ready" | "deployed" | "archived";
          draft_context?: Json;
          intake_fields?: Json;
          blockers?: Json;
          plan?: Json;
          challenge_result?: Json | null;
          parent_draft_id?: string | null;
          deployed_trade_id?: string | null;
          firm_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trade_events: {
        Row: {
          id: string;
          user_id: string;
          entity_type: "draft" | "trade";
          entity_id: string;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: "draft" | "trade";
          entity_id: string;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: Record<string, never>; // append-only — no updates
        Relationships: [];
      };
      trade_reviews: {
        Row: {
          id: string;
          user_id: string;
          trade_id: string;
          execution_adherence: "clean" | "minor_deviation" | "major_deviation" | null;
          deviation_tag: string | null;
          override_present: boolean;
          override_r_cost: number | null;
          rule_based_exit_estimate: Json | null;
          lesson: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trade_id: string;
          execution_adherence?: "clean" | "minor_deviation" | "major_deviation" | null;
          deviation_tag?: string | null;
          override_present?: boolean;
          override_r_cost?: number | null;
          rule_based_exit_estimate?: Json | null;
          lesson?: string | null;
          created_at?: string;
        };
        Update: {
          execution_adherence?: "clean" | "minor_deviation" | "major_deviation" | null;
          deviation_tag?: string | null;
          override_present?: boolean;
          override_r_cost?: number | null;
          rule_based_exit_estimate?: Json | null;
          lesson?: string | null;
        };
        Relationships: [];
      };
      workflow_tasks: {
        Row: {
          id: string;
          user_id: string;
          task_type: string;
          entity_type: string | null;
          entity_id: string | null;
          due_at: string;
          completed_at: string | null;
          payload: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          due_at: string;
          completed_at?: string | null;
          payload?: Json;
        };
        Update: {
          task_type?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          due_at?: string;
          completed_at?: string | null;
          payload?: Json;
        };
        Relationships: [];
      };
      strategy_parameter_definitions: {
        Row: {
          id: string;
          strategy_id: string;
          name: string;
          type: "numeric" | "price" | "level" | "enum" | "text" | "boolean";
          operational_class: "informational" | "required_for_deploy" | "required_for_monitoring";
          scope: "context" | "contract" | "risk" | "execution";
          comparison_semantics: Json | null;
          source_expectations: Json | null;
          lock_behaviour: "lock_on_deploy" | "lock_on_confirm" | "soft";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          strategy_id: string;
          name: string;
          type: "numeric" | "price" | "level" | "enum" | "text" | "boolean";
          operational_class: "informational" | "required_for_deploy" | "required_for_monitoring";
          scope: "context" | "contract" | "risk" | "execution";
          comparison_semantics?: Json | null;
          source_expectations?: Json | null;
          lock_behaviour?: "lock_on_deploy" | "lock_on_confirm" | "soft";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          type?: "numeric" | "price" | "level" | "enum" | "text" | "boolean";
          operational_class?: "informational" | "required_for_deploy" | "required_for_monitoring";
          scope?: "context" | "contract" | "risk" | "execution";
          comparison_semantics?: Json | null;
          source_expectations?: Json | null;
          lock_behaviour?: "lock_on_deploy" | "lock_on_confirm" | "soft";
          updated_at?: string;
        };
        Relationships: [];
      };
      trade_parameter_values: {
        Row: {
          id: string;
          trade_id: string | null;
          draft_id: string | null;
          parameter_definition_id: string;
          value: Json;
          locked_at: string;
          provenance: "user" | "ai_extract" | "ai_suggest" | "market_derived";
        };
        Insert: {
          id?: string;
          trade_id?: string | null;
          draft_id?: string | null;
          parameter_definition_id: string;
          value: Json;
          locked_at?: string;
          provenance: "user" | "ai_extract" | "ai_suggest" | "market_derived";
        };
        Update: {
          value?: Json;
          provenance?: "user" | "ai_extract" | "ai_suggest" | "market_derived";
        };
        Relationships: [];
      };
      trade_evidence_records: {
        Row: {
          id: string;
          user_id: string;
          trade_id: string | null;
          draft_id: string | null;
          provider: string;
          source_label: string;
          citation_url: string | null;
          captured_at: string;
          normalized_payload: Json;
          silent_update: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          trade_id?: string | null;
          draft_id?: string | null;
          provider: string;
          source_label: string;
          citation_url?: string | null;
          captured_at?: string;
          normalized_payload: Json;
          silent_update?: boolean;
        };
        Update: {
          citation_url?: string | null;
          normalized_payload?: Json;
          silent_update?: boolean;
        };
        Relationships: [];
      };
      trade_monitoring_rules: {
        Row: {
          id: string;
          trade_id: string;
          cadence_seconds: number;
          invalidation_conditions: Json;
          silent_update_thresholds: Json;
          critical_alert_routing: Json;
          next_parameter_check_at: string | null;
          last_parameter_check_at: string | null;
          last_parameter_check_result: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trade_id: string;
          cadence_seconds?: number;
          invalidation_conditions?: Json;
          silent_update_thresholds?: Json;
          critical_alert_routing?: Json;
          next_parameter_check_at?: string | null;
          last_parameter_check_at?: string | null;
          last_parameter_check_result?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          cadence_seconds?: number;
          invalidation_conditions?: Json;
          silent_update_thresholds?: Json;
          critical_alert_routing?: Json;
          next_parameter_check_at?: string | null;
          last_parameter_check_at?: string | null;
          last_parameter_check_result?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trade_monitor_checks: {
        Row: {
          id: string;
          trade_id: string;
          ran_at: string;
          result: Json;
          alert_fired: "invalidation_breached" | "sl_hit" | "target_hit" | "sl_proximity" | null;
        };
        Insert: {
          id?: string;
          trade_id: string;
          ran_at?: string;
          result: Json;
          alert_fired?: "invalidation_breached" | "sl_hit" | "target_hit" | "sl_proximity" | null;
        };
        Update: Record<string, never>; // immutable history
        Relationships: [];
      };
      trade_silent_updates: {
        Row: {
          id: string;
          trade_id: string;
          kind: "context_change" | "price_drift" | "news" | "parameter_drift";
          summary: string;
          evidence_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trade_id: string;
          kind: "context_change" | "price_drift" | "news" | "parameter_drift";
          summary: string;
          evidence_id?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>; // immutable
        Relationships: [];
      };
      // ---------------------------------------------------------------
      // Outcome attribution tables (migration 016)
      // ---------------------------------------------------------------
      strategy_outcomes: {
        Row: {
          id: string;
          user_id: string;
          trade_id: string;
          strategy_id: string;
          strategy_version_id: string | null;
          outcome_r: number;
          mae_r: number | null;
          mfe_r: number | null;
          touched_1r: boolean;
          touched_2r: boolean;
          touched_3r: boolean;
          holding_minutes: number | null;
          first_parameter_failure_at: string | null;
          estimated_r_without_override: number | null;
          had_override: boolean;
          override_r_cost: number | null;
          execution_classification: "clean" | "minor_deviation" | "major_deviation" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trade_id: string;
          strategy_id: string;
          strategy_version_id?: string | null;
          outcome_r: number;
          mae_r?: number | null;
          mfe_r?: number | null;
          touched_1r?: boolean;
          touched_2r?: boolean;
          touched_3r?: boolean;
          holding_minutes?: number | null;
          first_parameter_failure_at?: string | null;
          estimated_r_without_override?: number | null;
          had_override?: boolean;
          override_r_cost?: number | null;
          execution_classification?: "clean" | "minor_deviation" | "major_deviation" | null;
          created_at?: string;
        };
        Update: {
          outcome_r?: number;
          mae_r?: number | null;
          mfe_r?: number | null;
          touched_1r?: boolean;
          touched_2r?: boolean;
          touched_3r?: boolean;
          holding_minutes?: number | null;
          first_parameter_failure_at?: string | null;
          estimated_r_without_override?: number | null;
          had_override?: boolean;
          override_r_cost?: number | null;
          execution_classification?: "clean" | "minor_deviation" | "major_deviation" | null;
        };
        Relationships: [];
      };
      strategy_statistics: {
        Row: {
          strategy_id: string;
          sample_size: number;
          win_rate: number | null;
          expectancy_r: number | null;
          avg_mae_r: number | null;
          avg_mfe_r: number | null;
          override_rate: number | null;
          override_cost_total_r: number | null;
          parameter_failure_latency_p50: number | null;
          target_capture_efficiency: number | null;
          last_computed_at: string;
        };
        Insert: {
          strategy_id: string;
          sample_size?: number;
          win_rate?: number | null;
          expectancy_r?: number | null;
          avg_mae_r?: number | null;
          avg_mfe_r?: number | null;
          override_rate?: number | null;
          override_cost_total_r?: number | null;
          parameter_failure_latency_p50?: number | null;
          target_capture_efficiency?: number | null;
          last_computed_at?: string;
        };
        Update: {
          sample_size?: number;
          win_rate?: number | null;
          expectancy_r?: number | null;
          avg_mae_r?: number | null;
          avg_mfe_r?: number | null;
          override_rate?: number | null;
          override_cost_total_r?: number | null;
          parameter_failure_latency_p50?: number | null;
          target_capture_efficiency?: number | null;
          last_computed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}