import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { humanizeApiError } from "@/lib/humanizeApiError";
import { toast } from "sonner";
import type { SupportRole } from "@/api/contact";

export type SupportFormCopy = {
  fullName: string;
  email: string;
  phone: string;
  phoneOptional: string;
  role: string;
  roleUser: string;
  roleCoach: string;
  roleOther: string;
  subject: string;
  message: string;
  submit: string;
  submitting: string;
  success: string;
};

type PublicProps = {
  mode: "public";
  copy: SupportFormCopy;
  onSubmit: (body: {
    full_name: string;
    email: string;
    phone?: string | null;
    role: SupportRole;
    subject: string;
    message: string;
  }) => Promise<{ message: string }>;
};

type AuthProps = {
  mode: "authenticated";
  copy: SupportFormCopy;
  accountName: string;
  accountEmail: string;
  onSubmit: (body: {
    subject: string;
    message: string;
    phone?: string | null;
  }) => Promise<{ message: string }>;
};

type Props = PublicProps | AuthProps;

export function SupportQueryForm(props: Props) {
  const { copy } = props;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SupportRole>("user");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (props.mode === "public") {
        return props.onSubmit({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role,
          subject: subject.trim(),
          message: message.trim(),
        });
      }
      return props.onSubmit({
        subject: subject.trim(),
        message: message.trim(),
        phone: phone.trim() || null,
      });
    },
    onSuccess: (res) => {
      toast.success(res.message || copy.success);
      setSubject("");
      setMessage("");
      setPhone("");
      if (props.mode === "public") {
        setFullName("");
        setEmail("");
        setRole("user");
      }
    },
    onError: (err) => toast.error(humanizeApiError(err)),
  });

  const canSubmit =
    subject.trim().length >= 3 &&
    message.trim().length >= 10 &&
    !mut.isPending &&
    (props.mode === "authenticated" ||
      (fullName.trim().length >= 2 && email.trim().includes("@")));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        mut.mutate();
      }}
    >
      {props.mode === "public" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="support-name">{copy.fullName}</Label>
            <Input
              id="support-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">{copy.email}</Label>
            <Input
              id="support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-role">{copy.role}</Label>
            <select
              id="support-role"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as SupportRole)}
            >
              <option value="user">{copy.roleUser}</option>
              <option value="coach">{copy.roleCoach}</option>
              <option value="other">{copy.roleOther}</option>
            </select>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <p className="font-medium text-foreground">{props.accountName}</p>
          <p className="text-muted-foreground">{props.accountEmail}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="support-phone">
          {copy.phone} <span className="text-muted-foreground font-normal">({copy.phoneOptional})</span>
        </Label>
        <Input
          id="support-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-subject">{copy.subject}</Label>
        <Input
          id="support-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-message">{copy.message}</Label>
        <Textarea
          id="support-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={6}
        />
      </div>

      <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
        {mut.isPending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
