import { NextResponse } from "next/server";

export async function GET() {
  // CSV template with headers and example data
  const csvTemplate = `name,phone_number,tags
John Doe,+60123456789,Customer
Jane Smith,+60198765432,VIP
Ahmad Abdullah,+60111122333,Lead
Siti Aminah,+60173344222,Friend
Example Contact,+60123456789,

Note:
- name: Contact name (optional)
- phone_number: Phone number with country code (required), e.g. +60 for Malaysia
- tags: Comma-separated tag names (optional)
- Remove all example rows before importing your data
- Phone numbers must be registered with WhatsApp`;

  return new NextResponse(csvTemplate, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="contacts_template.csv"',
    },
  });
}
