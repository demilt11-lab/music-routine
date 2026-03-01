import { ChevronDown, Bluetooth, Watch, Radio, MousePointer } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const BluetoothSetupGuide = forwardRef<HTMLOListElement>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    { icon: Bluetooth, title: "Enable Bluetooth", desc: "Turn on Bluetooth in your device settings." },
    { icon: Watch, title: "Prepare your device", desc: "Open a HR broadcasting app on Apple Watch (e.g. Heart Analyzer) OR ensure your BLE HR monitor is in pairing mode." },
    { icon: Radio, title: "Scan for Devices", desc: "Click 'Connect Device' above to start scanning for nearby BLE heart rate monitors." },
    { icon: MousePointer, title: "Select your device", desc: "Pick your device from the browser popup. Once connected, live heart rate data will stream automatically." },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
        <span>Setup guide</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol ref={ref} className="space-y-3 pt-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <step.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
});

BluetoothSetupGuide.displayName = "BluetoothSetupGuide";
