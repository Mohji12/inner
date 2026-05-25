import { AlignLeft, Eye, Languages, MousePointer2, RefreshCw, Type } from "lucide-react";
import { AccessibilityAdjustmentIcon } from "@/components/accessibility/AccessibilityAdjustmentIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAccessibility } from "@/accessibility/AccessibilityContext";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AccessibilityWidget() {
  const { settings, patchSettings, applyProfile, resetSettings } = useAccessibility();
  const { t } = useLanguage();
  const a = t.app.accessibility;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="fixed bottom-5 right-5 z-[2147483647] h-24 w-24 rounded-full p-0 shadow-xl hover:bg-transparent hover:opacity-90 [&_svg]:!size-full"
          title={a.openPanel}
        >
          <AccessibilityAdjustmentIcon className="size-full shrink-0" />
          <span className="sr-only">{a.openPanel}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[92vw] overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{a.title}</SheetTitle>
          <SheetDescription>{a.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 pb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4" /> {a.profilesTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="outline" onClick={() => applyProfile("vision")}>
                {a.profileVision}
              </Button>
              <Button variant="outline" onClick={() => applyProfile("adhd")}>
                {a.profileAdhd}
              </Button>
              <Button variant="outline" onClick={() => applyProfile("seizure")}>
                {a.profileSeizure}
              </Button>
              <Button variant="outline" onClick={() => applyProfile("none")}>
                {a.profileClear}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="h-4 w-4" /> {a.contentModules}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{a.fontSize}</Label>
                  <span className="text-sm text-muted-foreground">{settings.fontScale}%</span>
                </div>
                <Slider
                  value={[settings.fontScale]}
                  min={80}
                  max={160}
                  step={10}
                  onValueChange={(v) => patchSettings({ fontScale: v[0] ?? 100 })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{a.lineHeight}</Label>
                  <span className="text-sm text-muted-foreground">{settings.lineHeight.toFixed(1)}</span>
                </div>
                <Slider
                  value={[settings.lineHeight]}
                  min={1.2}
                  max={2.2}
                  step={0.1}
                  onValueChange={(v) => patchSettings({ lineHeight: Number((v[0] ?? 1.5).toFixed(1)) })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{a.letterSpacing}</Label>
                  <span className="text-sm text-muted-foreground">{settings.letterSpacing.toFixed(1)}px</span>
                </div>
                <Slider
                  value={[settings.letterSpacing]}
                  min={0}
                  max={3}
                  step={0.1}
                  onValueChange={(v) => patchSettings({ letterSpacing: Number((v[0] ?? 0).toFixed(1)) })}
                />
              </div>

              <ToggleRow
                label={a.readableFont}
                checked={settings.readableFont}
                onCheckedChange={(checked) => patchSettings({ readableFont: checked })}
              />
              <ToggleRow
                label={a.boldText}
                checked={settings.boldText}
                onCheckedChange={(checked) => patchSettings({ boldText: checked })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlignLeft className="h-4 w-4" /> {a.orientationModules}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{a.textAlign}</Label>
                <Select value={settings.textAlign} onValueChange={(v) => patchSettings({ textAlign: v as typeof settings.textAlign })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{a.alignDefault}</SelectItem>
                    <SelectItem value="left">{a.alignLeft}</SelectItem>
                    <SelectItem value="center">{a.alignCenter}</SelectItem>
                    <SelectItem value="right">{a.alignRight}</SelectItem>
                    <SelectItem value="justify">{a.alignJustify}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{a.contrastModes}</Label>
                <Select value={settings.contrast} onValueChange={(v) => patchSettings({ contrast: v as typeof settings.contrast })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{a.contrastDefault}</SelectItem>
                    <SelectItem value="light">{a.contrastLight}</SelectItem>
                    <SelectItem value="high">{a.contrastHigh}</SelectItem>
                    <SelectItem value="monochrome">{a.contrastMonochrome}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{a.colorblindModes}</Label>
                <Select
                  value={settings.colorblindMode}
                  onValueChange={(v) => patchSettings({ colorblindMode: v as typeof settings.colorblindMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{a.colorblindNone}</SelectItem>
                    <SelectItem value="protanopia">{a.colorblindProtanopia}</SelectItem>
                    <SelectItem value="deuteranopia">{a.colorblindDeuteranopia}</SelectItem>
                    <SelectItem value="tritanopia">{a.colorblindTritanopia}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MousePointer2 className="h-4 w-4" /> {a.assistModules}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>{a.cursorMode}</Label>
                <Select value={settings.cursor} onValueChange={(v) => patchSettings({ cursor: v as typeof settings.cursor })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{a.cursorDefault}</SelectItem>
                    <SelectItem value="large">{a.cursorLarge}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ToggleRow
                label={a.hideImages}
                checked={settings.hideImages}
                onCheckedChange={(checked) => patchSettings({ hideImages: checked })}
              />
              <ToggleRow
                label={a.highlightLinks}
                checked={settings.highlightLinks}
                onCheckedChange={(checked) => patchSettings({ highlightLinks: checked })}
              />
              <ToggleRow
                label={a.highlightContent}
                checked={settings.highlightContent}
                onCheckedChange={(checked) => patchSettings({ highlightContent: checked })}
              />
              <ToggleRow
                label={a.stopAnimations}
                checked={settings.stopAnimations}
                onCheckedChange={(checked) => patchSettings({ stopAnimations: checked })}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={resetSettings}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {a.reset}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" disabled>
              <Languages className="mr-2 h-4 w-4" />
              {a.languageAuto}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
