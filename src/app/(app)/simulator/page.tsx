import { businessConfig } from "@/config";
import SimulatorChat from "./chat";

export default function SimulatorPage() {
  return <SimulatorChat businessName={businessConfig.name} />;
}
