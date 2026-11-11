import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/guards";
import { roleForEmail } from "./lib/rbac";
import { cleanLine } from "./lib/text";

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Sign in to continue.");
    }
    const email = identity.email?.trim().toLowerCase();
    const name = cleanLine(identity.name ?? "", 1, 80);
    if (!email || !email.includes("@") || !name) {
      throw new ConvexError(
        "Your account needs a name and email. Add them in the Clerk JWT template.",
      );
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    const role = roleForEmail(
      email,
      existing?.role ?? null,
      process.env.ADMIN_EMAILS ?? "",
    );

    if (!existing) {
      return await ctx.db.insert("users", {
        clerkId: identity.subject,
        email,
        name,
        role,
        trustedLender: false,
      });
    }

    await ctx.db.patch(existing._id, { email, name, role });
    return existing._id;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});
