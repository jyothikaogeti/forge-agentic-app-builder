import { auth, currentUser } from "@clerk/nextjs/server";

import { Plan } from "@/types/plans";
import { PLANS } from "./constants";
import { prisma } from "./prisma";

async function getCurrentPlan(): Promise<Plan> {
  const { has } = await auth();

  if (has({ plan: "pro" })) return "pro";
  if (has({ plan: "starter" })) return "starter";

  return "free";
}

export async function getUser() {
  const user = await currentUser();
  if (!user) {
    return null;
  }

  try {
    const currentPlan = await getCurrentPlan();

    const existingUser = await prisma.user.findUnique({
      where: {
        clerkId: user.id,
      },
    });

    if (existingUser) {
      if (existingUser.plan === currentPlan) {
        return existingUser;
      }
      return await prisma.user.update({
        where: {
          clerkId: user.id,
        },
        data: {
          plan: currentPlan,
          credits: {
            increment: PLANS[currentPlan].credits,
          },
        },
      });
    }

    return await prisma.user.create({
      data: {
        clerkId: user.id,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        email: user.emailAddresses[0].emailAddress ?? "",
        imageUrl: user.imageUrl ?? "",
        credits: PLANS.free.credits,
        plan: "free",
      },
    });
  } catch (error) {
    console.error("getUser error:", error);
    throw new Error("Failed to get user");
  }
}
