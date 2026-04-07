import { redirect } from "next/navigation";

export default async function MarketWatchPage() {
  redirect("/portfolio-analytics?tab=marketwatch");
}