import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = session.user.role;

  switch (role) {
    case "WARGA":
      redirect("/warga");
    case "STAF_DESA":
      redirect("/staf");
    case "SUPERVISOR":
      redirect("/supervisor");
    case "KEPALA_DESA":
      redirect("/kades");
    default:
      redirect("/unauthorized");
  }
}
