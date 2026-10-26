/** Display format for ticket numbers: ticketNumber 1001 -> "BL-1001". The sequence starts at 1001 (see migration). */
export const formatTicketNumber = (n: number): string => `BL-${n}`;
