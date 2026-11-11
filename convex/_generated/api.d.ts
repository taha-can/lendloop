/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as admin from "../admin.js";
import type * as automation from "../automation.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_enqueue from "../lib/enqueue.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_validators from "../lib/validators.js";
import type * as requests from "../requests.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "admin": typeof admin,
"automation": typeof automation,
"crons": typeof crons,
"http": typeof http,
"lib/constants": typeof lib_constants,
"lib/dates": typeof lib_dates,
"lib/enqueue": typeof lib_enqueue,
"lib/events": typeof lib_events,
"lib/guards": typeof lib_guards,
"lib/hmac": typeof lib_hmac,
"lib/idempotency": typeof lib_idempotency,
"lib/notifications": typeof lib_notifications,
"lib/rbac": typeof lib_rbac,
"lib/text": typeof lib_text,
"lib/validators": typeof lib_validators,
"requests": typeof requests,
"tools": typeof tools,
"users": typeof users,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  