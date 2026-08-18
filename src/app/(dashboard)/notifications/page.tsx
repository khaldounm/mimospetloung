import { redirect } from "next/navigation";
import { NOTIFICATION_TABS } from "@/constants/notification";

// Bare /notifications lands on the first tab.
export default function NotificationsIndexPage() {
  redirect(`/notifications/${NOTIFICATION_TABS[0].slug}`);
}
