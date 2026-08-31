export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      athlete_equipment: {
        Row: {
          athlete_id: string
          created_at: string
          equipment_type: string
          id: string
          item: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          equipment_type: string
          id?: string
          item: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          equipment_type?: string
          id?: string
          item?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_equipment_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          person_id: string | null
          sport: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          person_id?: string | null
          sport?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          person_id?: string | null
          sport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "household_people"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          active: boolean
          brand: string | null
          category: string
          created_at: string
          default_unit: string | null
          display_name: string
          id: string
          image_attribution: string | null
          image_license: string | null
          image_ready: boolean
          image_source_url: string | null
          image_url: string | null
          manually_edited: boolean
          normalized_name: string
          preferred_retailer_id: string | null
          preferred_store_hint: string | null
          search_aliases: string[]
          search_text: string
          source: string
          source_notes: string | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category: string
          created_at?: string
          default_unit?: string | null
          display_name: string
          id: string
          image_attribution?: string | null
          image_license?: string | null
          image_ready?: boolean
          image_source_url?: string | null
          image_url?: string | null
          manually_edited?: boolean
          normalized_name: string
          preferred_retailer_id?: string | null
          preferred_store_hint?: string | null
          search_aliases?: string[]
          search_text?: string
          source?: string
          source_notes?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string
          created_at?: string
          default_unit?: string | null
          display_name?: string
          id?: string
          image_attribution?: string | null
          image_license?: string | null
          image_ready?: boolean
          image_source_url?: string | null
          image_url?: string | null
          manually_edited?: boolean
          normalized_name?: string
          preferred_retailer_id?: string | null
          preferred_store_hint?: string | null
          search_aliases?: string[]
          search_text?: string
          source?: string
          source_notes?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "catalog_products_category_subcategory_fkey"
            columns: ["category", "subcategory"]
            isOneToOne: false
            referencedRelation: "product_subcategories"
            referencedColumns: ["category", "name"]
          },
          {
            foreignKeyName: "catalog_products_preferred_retailer_id_fkey"
            columns: ["preferred_retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          hero_placeholder: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          hero_placeholder: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          hero_placeholder?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          added_by: string | null
          catalog_product_id: string | null
          category: string
          checked: boolean
          created_at: string
          has_deal: boolean
          household_id: string
          id: string
          name: string
          note: string | null
          person_id: string | null
          qty: string | null
          retailer_id: string | null
          source: string
        }
        Insert: {
          added_by?: string | null
          catalog_product_id?: string | null
          category?: string
          checked?: boolean
          created_at?: string
          has_deal?: boolean
          household_id: string
          id?: string
          name: string
          note?: string | null
          person_id?: string | null
          qty?: string | null
          retailer_id?: string | null
          source?: string
        }
        Update: {
          added_by?: string | null
          catalog_product_id?: string | null
          category?: string
          checked?: boolean
          created_at?: string
          has_deal?: boolean
          household_id?: string
          id?: string
          name?: string
          note?: string | null
          person_id?: string | null
          qty?: string | null
          retailer_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_items_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "household_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_items_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      household_inventory_state: {
        Row: {
          catalog_product_id: string
          created_at: string
          household_id: string
          id: string
          note: string | null
          quantity: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_product_id: string
          created_at?: string
          household_id: string
          id?: string
          note?: string | null
          quantity?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_product_id?: string
          created_at?: string
          household_id?: string
          id?: string
          note?: string | null
          quantity?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_inventory_state_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_inventory_state_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          note: string | null
          person_id: string | null
          plan_date: string
          recipe_id: string | null
          slot: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          note?: string | null
          person_id?: string | null
          plan_date: string
          recipe_id?: string | null
          slot: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          note?: string | null
          person_id?: string | null
          plan_date?: string
          recipe_id?: string | null
          slot?: string
          title?: string | null
        }
        Relationships: []
      }
      recipe_person_preferences: {
        Row: {
          created_at: string
          household_id: string
          id: string
          person_id: string
          recipe_id: string
          sentiment: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          person_id: string
          recipe_id: string
          sentiment: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          person_id?: string
          recipe_id?: string
          sentiment?: string
        }
        Relationships: []
      }
      household_people: {
        Row: {
          created_at: string
          household_id: string
          allergies: string[]
          dislikes: string[]
          id: string
          is_child: boolean
          name: string
          notes?: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          allergies?: string[]
          dislikes?: string[]
          id?: string
          is_child?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          allergies?: string[]
          dislikes?: string[]
          id?: string
          is_child?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_people_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_product_preferences: {
        Row: {
          acceptable_brands: string[]
          acceptable_stores: string[]
          brand_rigidity: string
          created_at: string
          household_id: string
          is_favourite: boolean
          id: string
          image_url: string | null
          label: string
          notes: string | null
          preferred_brand: string | null
          preferred_retailer_id: string | null
          preferred_size: string | null
          preferred_store: string | null
          preferred_variant: string | null
          regular_buy: boolean
          scope_key: string
          scope_type: string
          stock_location: string | null
          typical_quantity: string | null
          updated_at: string
        }
        Insert: {
          acceptable_brands?: string[]
          acceptable_stores?: string[]
          brand_rigidity?: string
          created_at?: string
          household_id: string
          is_favourite?: boolean
          id?: string
          image_url?: string | null
          label: string
          notes?: string | null
          preferred_brand?: string | null
          preferred_retailer_id?: string | null
          preferred_size?: string | null
          preferred_store?: string | null
          preferred_variant?: string | null
          regular_buy?: boolean
          scope_key: string
          scope_type: string
          stock_location?: string | null
          typical_quantity?: string | null
          updated_at?: string
        }
        Update: {
          acceptable_brands?: string[]
          acceptable_stores?: string[]
          brand_rigidity?: string
          created_at?: string
          household_id?: string
          is_favourite?: boolean
          id?: string
          image_url?: string | null
          label?: string
          notes?: string | null
          preferred_brand?: string | null
          preferred_retailer_id?: string | null
          preferred_size?: string | null
          preferred_store?: string | null
          preferred_variant?: string | null
          regular_buy?: boolean
          scope_key?: string
          scope_type?: string
          stock_location?: string | null
          typical_quantity?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_product_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_product_preferences_preferred_retailer_id_fkey"
            columns: ["preferred_retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      household_purchases: {
        Row: {
          catalog_product_id: string | null
          created_at: string
          discount_cents: number | null
          household_id: string
          id: string
          line_total_cents: number
          person_id: string | null
          purchase_date: string
          quantity: number | null
          receipt_id: string | null
          receipt_item_id: string | null
          retailer_id: string | null
          retailer_location_id: string | null
          unit_price_cents: number | null
        }
        Insert: {
          catalog_product_id?: string | null
          created_at?: string
          discount_cents?: number | null
          household_id: string
          id?: string
          line_total_cents: number
          person_id?: string | null
          purchase_date: string
          quantity?: number | null
          receipt_id?: string | null
          receipt_item_id?: string | null
          retailer_id?: string | null
          retailer_location_id?: string | null
          unit_price_cents?: number | null
        }
        Update: {
          catalog_product_id?: string | null
          created_at?: string
          discount_cents?: number | null
          household_id?: string
          id?: string
          line_total_cents?: number
          person_id?: string | null
          purchase_date?: string
          quantity?: number | null
          receipt_id?: string | null
          receipt_item_id?: string | null
          retailer_id?: string | null
          retailer_location_id?: string | null
          unit_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "household_purchases_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_purchases_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_purchases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "household_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_purchases_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_purchases_receipt_item_id_fkey"
            columns: ["receipt_item_id"]
            isOneToOne: false
            referencedRelation: "receipt_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_purchases_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_purchases_retailer_location_id_fkey"
            columns: ["retailer_location_id"]
            isOneToOne: false
            referencedRelation: "retailer_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      household_settings: {
        Row: {
          city: string | null
          country: string
          household_id: string
          postal_code: string | null
          preferred_retailer_ids: string[]
          province: string | null
          search_radii_km: Json
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string
          household_id: string
          postal_code?: string | null
          preferred_retailer_ids?: string[]
          province?: string | null
          search_radii_km?: Json
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string
          household_id?: string
          postal_code?: string | null
          preferred_retailer_ids?: string[]
          province?: string | null
          search_radii_km?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_settings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          join_code: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string | null
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          household_id: string
          id: string
          kind: string
          read: boolean
          title: string
          watch_item_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          household_id: string
          id?: string
          kind: string
          read?: boolean
          title: string
          watch_item_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          watch_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_watch_item_id_fkey"
            columns: ["watch_item_id"]
            isOneToOne: false
            referencedRelation: "watch_items"
            referencedColumns: ["id"]
          },
        ]
      }
      owned_products: {
        Row: {
          created_at: string
          department_key: string | null
          household_id: string
          id: string
          name: string
          product_id: string | null
          purchase_date: string | null
          purchase_price_cents: number | null
          retailer_id: string | null
          room_id: string | null
          serial: string | null
          warranty_until: string | null
        }
        Insert: {
          created_at?: string
          department_key?: string | null
          household_id: string
          id?: string
          name: string
          product_id?: string | null
          purchase_date?: string | null
          purchase_price_cents?: number | null
          retailer_id?: string | null
          room_id?: string | null
          serial?: string | null
          warranty_until?: string | null
        }
        Update: {
          created_at?: string
          department_key?: string | null
          household_id?: string
          id?: string
          name?: string
          product_id?: string | null
          purchase_date?: string | null
          purchase_price_cents?: number | null
          retailer_id?: string | null
          room_id?: string | null
          serial?: string | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owned_products_department_key_fkey"
            columns: ["department_key"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "owned_products_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_products_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_products_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          captured_at: string
          currency: string
          id: string
          in_stock: boolean | null
          price_cents: number
          product_id: string
          retailer_id: string | null
          source: string
        }
        Insert: {
          captured_at?: string
          currency?: string
          id?: string
          in_stock?: boolean | null
          price_cents: number
          product_id: string
          retailer_id?: string | null
          source?: string
        }
        Update: {
          captured_at?: string
          currency?: string
          id?: string
          in_stock?: boolean | null
          price_cents?: number
          product_id?: string
          retailer_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_snapshots_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_alternatives: {
        Row: {
          alternative_product_id: string
          created_at: string
          id: string
          match_quality: string
          notes: string | null
          product_id: string
        }
        Insert: {
          alternative_product_id: string
          created_at?: string
          id?: string
          match_quality: string
          notes?: string | null
          product_id: string
        }
        Update: {
          alternative_product_id?: string
          created_at?: string
          id?: string
          match_quality?: string
          notes?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_alternatives_alternative_product_id_fkey"
            columns: ["alternative_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alternatives_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          name: string
          sort_order: number
        }
        Insert: {
          name: string
          sort_order?: number
        }
        Update: {
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_subcategories: {
        Row: {
          category: string
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["name"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          catalog_product_id: string | null
          created_at: string
          created_by: string | null
          department_key: string | null
          external_id: string | null
          household_id: string
          is_favourite: boolean
          id: string
          image_url: string | null
          is_regular_buy: boolean
          package_detail: string | null
          product_url: string | null
          retailer_id: string | null
          room_id: string | null
          stock_status: string | null
          target_price_cents: number | null
          title: string
        }
        Insert: {
          brand?: string | null
          catalog_product_id?: string | null
          created_at?: string
          created_by?: string | null
          department_key?: string | null
          external_id?: string | null
          household_id: string
          is_favourite?: boolean
          id?: string
          image_url?: string | null
          is_regular_buy?: boolean
          package_detail?: string | null
          product_url?: string | null
          retailer_id?: string | null
          room_id?: string | null
          stock_status?: string | null
          target_price_cents?: number | null
          title: string
        }
        Update: {
          brand?: string | null
          catalog_product_id?: string | null
          created_at?: string
          created_by?: string | null
          department_key?: string | null
          external_id?: string | null
          household_id?: string
          is_favourite?: boolean
          id?: string
          image_url?: string | null
          is_regular_buy?: boolean
          package_detail?: string | null
          product_url?: string | null
          retailer_id?: string | null
          room_id?: string | null
          stock_status?: string | null
          target_price_cents?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_department_key_fkey"
            columns: ["department_key"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "products_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          catalog_product_id: string | null
          confirmed_by_user: boolean
          discount_cents: number | null
          id: string
          line_total_cents: number | null
          line_type: string
          match_confidence: number | null
          match_method: string | null
          match_status: string
          name: string | null
          person_id: string | null
          price_cents: number | null
          product_id: string | null
          quantity: number | null
          raw_description: string | null
          receipt_id: string
          sort_order: number
          unit_price_cents: number | null
        }
        Insert: {
          catalog_product_id?: string | null
          confirmed_by_user?: boolean
          discount_cents?: number | null
          id?: string
          line_total_cents?: number | null
          line_type?: string
          match_confidence?: number | null
          match_method?: string | null
          match_status?: string
          name?: string | null
          person_id?: string | null
          price_cents?: number | null
          product_id?: string | null
          quantity?: number | null
          raw_description?: string | null
          receipt_id: string
          sort_order?: number
          unit_price_cents?: number | null
        }
        Update: {
          catalog_product_id?: string | null
          confirmed_by_user?: boolean
          discount_cents?: number | null
          id?: string
          line_total_cents?: number | null
          line_type?: string
          match_confidence?: number | null
          match_method?: string | null
          match_status?: string
          name?: string | null
          person_id?: string | null
          price_cents?: number | null
          product_id?: string | null
          quantity?: number | null
          raw_description?: string | null
          receipt_id?: string
          sort_order?: number
          unit_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "household_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          document_hash: string | null
          extraction_confidence: number | null
          extraction_error: string | null
          extractor: string | null
          household_id: string
          id: string
          image_url: string | null
          processed_at: string | null
          purchased_at: string | null
          purchased_time: string | null
          raw_text: string | null
          retailer_id: string | null
          retailer_location_id: string | null
          status: string
          storage_path: string | null
          subtotal_cents: number | null
          tax_cents: number | null
          total_cents: number | null
          transaction_ref: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_hash?: string | null
          extraction_confidence?: number | null
          extraction_error?: string | null
          extractor?: string | null
          household_id: string
          id?: string
          image_url?: string | null
          processed_at?: string | null
          purchased_at?: string | null
          purchased_time?: string | null
          raw_text?: string | null
          retailer_id?: string | null
          retailer_location_id?: string | null
          status?: string
          storage_path?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number | null
          transaction_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_hash?: string | null
          extraction_confidence?: number | null
          extraction_error?: string | null
          extractor?: string | null
          household_id?: string
          id?: string
          image_url?: string | null
          processed_at?: string | null
          purchased_at?: string | null
          purchased_time?: string | null
          raw_text?: string | null
          retailer_id?: string | null
          retailer_location_id?: string | null
          status?: string
          storage_path?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number | null
          transaction_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_retailer_location_id_fkey"
            columns: ["retailer_location_id"]
            isOneToOne: false
            referencedRelation: "retailer_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          catalog_product_id: string | null
          id: string
          name: string
          qty: string | null
          recipe_id: string
          sort_order: number
          usual_retailer_id: string | null
        }
        Insert: {
          catalog_product_id?: string | null
          id?: string
          name: string
          qty?: string | null
          recipe_id: string
          sort_order?: number
          usual_retailer_id?: string | null
        }
        Update: {
          catalog_product_id?: string | null
          id?: string
          name?: string
          qty?: string | null
          recipe_id?: string
          sort_order?: number
          usual_retailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_usual_retailer_id_fkey"
            columns: ["usual_retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          household_id: string | null
          meal_types: string[]
          notes: string | null
          name: string
          servings: string | null
          time_minutes: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          household_id?: string | null
          meal_types?: string[]
          notes?: string | null
          name: string
          servings?: string | null
          time_minutes?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          household_id?: string | null
          meal_types?: string[]
          notes?: string | null
          name?: string
          servings?: string | null
          time_minutes?: number | null
        }
        Relationships: []
      }
      retailer_locations: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          distance_km: number | null
          drive_time_minutes: number | null
          external_location_id: string | null
          id: string
          last_verified_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          postal_code: string | null
          province: string | null
          retailer_id: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          distance_km?: number | null
          drive_time_minutes?: number | null
          external_location_id?: string | null
          id?: string
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          postal_code?: string | null
          province?: string | null
          retailer_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          distance_km?: number | null
          drive_time_minutes?: number | null
          external_location_id?: string | null
          id?: string
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          postal_code?: string | null
          province?: string | null
          retailer_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retailer_locations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      retailer_price_observations: {
        Row: {
          availability: string | null
          catalog_product_id: string | null
          created_at: string
          external_product_id: string | null
          household_id: string | null
          id: string
          image_url: string | null
          match_confidence: number | null
          match_method: string | null
          match_status: string
          observed_at: string
          observed_on: string | null
          observed_price_cents: number
          package_size: string | null
          promotion_text: string | null
          raw_brand: string | null
          raw_name: string | null
          raw_payload: Json | null
          receipt_id: string | null
          regular_price_cents: number | null
          retailer_id: string
          retailer_location_id: string | null
          source_type: string
          source_url: string | null
          unit: string | null
          unit_price_text: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          availability?: string | null
          catalog_product_id?: string | null
          created_at?: string
          external_product_id?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          match_confidence?: number | null
          match_method?: string | null
          match_status?: string
          observed_at?: string
          observed_on?: string | null
          observed_price_cents: number
          package_size?: string | null
          promotion_text?: string | null
          raw_brand?: string | null
          raw_name?: string | null
          raw_payload?: Json | null
          receipt_id?: string | null
          regular_price_cents?: number | null
          retailer_id: string
          retailer_location_id?: string | null
          source_type?: string
          source_url?: string | null
          unit?: string | null
          unit_price_text?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          availability?: string | null
          catalog_product_id?: string | null
          created_at?: string
          external_product_id?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          match_confidence?: number | null
          match_method?: string | null
          match_status?: string
          observed_at?: string
          observed_on?: string | null
          observed_price_cents?: number
          package_size?: string | null
          promotion_text?: string | null
          raw_brand?: string | null
          raw_name?: string | null
          raw_payload?: Json | null
          receipt_id?: string | null
          regular_price_cents?: number | null
          retailer_id?: string
          retailer_location_id?: string | null
          source_type?: string
          source_url?: string | null
          unit?: string | null
          unit_price_text?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retailer_price_observations_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retailer_price_observations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retailer_price_observations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retailer_price_observations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retailer_price_observations_retailer_location_id_fkey"
            columns: ["retailer_location_id"]
            isOneToOne: false
            referencedRelation: "retailer_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      retailer_product_aliases: {
        Row: {
          catalog_product_id: string
          confidence: number
          confirmed_by_user: boolean
          created_at: string
          id: string
          last_seen_at: string
          raw_description: string
          retailer_id: string
          times_seen: number
        }
        Insert: {
          catalog_product_id: string
          confidence?: number
          confirmed_by_user?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          raw_description: string
          retailer_id: string
          times_seen?: number
        }
        Update: {
          catalog_product_id?: string
          confidence?: number
          confirmed_by_user?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          raw_description?: string
          retailer_id?: string
          times_seen?: number
        }
        Relationships: [
          {
            foreignKeyName: "retailer_product_aliases_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retailer_product_aliases_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      retailers: {
        Row: {
          created_at: string
          domain: string
          id: string
          kind: string
          logo_url: string | null
          name: string
          scan_enabled: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          kind?: string
          logo_url?: string | null
          name: string
          scan_enabled?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          scan_enabled?: boolean
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          household_id: string
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          household_id: string | null
          id: string
          prices_found: number
          products_scanned: number
          retailer_id: string | null
          retailer_location_id: string | null
          source: string
          started_at: string | null
          status: string
          targets_matched: number
          targets_requested: number
          trigger: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          household_id?: string | null
          id?: string
          prices_found?: number
          products_scanned?: number
          retailer_id?: string | null
          retailer_location_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          targets_matched?: number
          targets_requested?: number
          trigger?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          household_id?: string | null
          id?: string
          prices_found?: number
          products_scanned?: number
          retailer_id?: string | null
          retailer_location_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          targets_matched?: number
          targets_requested?: number
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_jobs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_jobs_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_jobs_retailer_location_id_fkey"
            columns: ["retailer_location_id"]
            isOneToOne: false
            referencedRelation: "retailer_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_items: {
        Row: {
          added_by: string | null
          athlete_id: string | null
          category: string | null
          created_at: string
          fit: string | null
          household_id: string
          id: string
          needed_by: string | null
          notes: string | null
          price_status: string
          product_id: string
          regular_price_cents: number | null
          room_id: string | null
          size: string | null
          status: string
          target_price_cents: number | null
        }
        Insert: {
          added_by?: string | null
          athlete_id?: string | null
          category?: string | null
          created_at?: string
          fit?: string | null
          household_id: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          price_status?: string
          product_id: string
          regular_price_cents?: number | null
          room_id?: string | null
          size?: string | null
          status?: string
          target_price_cents?: number | null
        }
        Update: {
          added_by?: string | null
          athlete_id?: string | null
          category?: string | null
          created_at?: string
          fit?: string | null
          household_id?: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          price_status?: string
          product_id?: string
          regular_price_cents?: number | null
          room_id?: string | null
          size?: string | null
          status?: string
          target_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_items_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_specs: {
        Row: {
          brands: string | null
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          max_price_cents: number | null
          requirements: string | null
          title: string
        }
        Insert: {
          brands?: string | null
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          max_price_cents?: number | null
          requirements?: string | null
          title: string
        }
        Update: {
          brands?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          max_price_cents?: number | null
          requirements?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_specs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      household_by_join_code: {
        Args: { code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      product_search_normalize: { Args: { input: string }; Returns: string }
      seed_starter_household_preferences: {
        Args: { target_household_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
