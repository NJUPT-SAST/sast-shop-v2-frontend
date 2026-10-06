import { redirect } from "next/navigation";

export default function WestPocketPage() {
  redirect("/orders?tab=pocket");
}
