'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface TicketInfo {
  valid: boolean;
  ticketCode: string;
  seatLabel: string;
  eventTitle: string;
  showtimeDate: string;
  venueName: string;
  status: string;
  message?: string;
}

export default function VerifyTicketPage() {
  const params = useParams();
  const code = params.code as string;
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await api.get(`/tickets/verify/${code}`);
        setTicket(res.data);
      } catch (err: any) {
        setTicket({
          valid: false,
          ticketCode: code,
          seatLabel: '',
          eventTitle: '',
          showtimeDate: '',
          venueName: '',
          status: 'INVALID',
          message: err?.response?.data?.message || 'Ticket not found or invalid',
        });
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [code]);

  if (loading) return <LoadingSpinner className="py-20" />;

  const isValid = ticket?.valid && ticket?.status !== 'CANCELLED' && ticket?.status !== 'USED';

  // Parse seat label
  const seatMatch = ticket?.seatLabel?.match(/^([A-Za-z]+)\s*[-]?\s*(\d+)$/);
  const row = seatMatch?.[1] || '';
  const seat = seatMatch?.[2] || '';

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div
          className={`rounded-3xl border-4 p-8 text-center shadow-2xl ${
            isValid
              ? 'border-green-500 bg-green-500/10 shadow-green-500/20'
              : 'border-red-500 bg-red-500/10 shadow-red-500/20'
          }`}
        >
          {/* Icon */}
          {isValid ? (
            <CheckCircleIcon className="mx-auto h-24 w-24 text-green-400" />
          ) : (
            <XCircleIcon className="mx-auto h-24 w-24 text-red-400" />
          )}

          {/* Status */}
          <h1
            className={`mt-4 text-5xl font-black uppercase tracking-wider ${
              isValid ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isValid ? 'VALID' : 'INVALID'}
          </h1>

          <p className="mt-2 text-lg text-gray-400">
            {ticket?.status === 'USED'
              ? 'This ticket has already been used'
              : ticket?.status === 'CANCELLED'
              ? 'This ticket has been cancelled'
              : isValid
              ? 'This ticket is valid for entry'
              : ticket?.message || 'This ticket is not valid'}
          </p>

          {/* Ticket Details */}
          {ticket?.eventTitle && (
            <div className="mt-6 space-y-3 rounded-xl bg-white/5 p-4 text-left">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Event</p>
                <p className="text-lg font-bold text-gray-100">{ticket.eventTitle}</p>
              </div>

              {ticket.venueName && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Venue</p>
                  <p className="text-sm text-gray-300">{ticket.venueName}</p>
                </div>
              )}

              {ticket.showtimeDate && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Date & Time</p>
                  <p className="text-sm text-gray-300">
                    {new Date(ticket.showtimeDate).toLocaleString()}
                  </p>
                </div>
              )}

              {ticket.seatLabel && (
                <div className="flex gap-6 border-t border-white/10 pt-3">
                  {row && (
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Row</p>
                      <p className="text-3xl font-black text-white">{row}</p>
                    </div>
                  )}
                  {seat && (
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Seat</p>
                      <p className="text-3xl font-black text-white">{seat}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ticket Code */}
          <p className="mt-4 font-mono text-xs text-gray-600">
            Ticket: {ticket?.ticketCode}
          </p>

          {/* Branding */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
              <span className="text-sm font-bold text-white">B</span>
            </div>
            <span className="text-sm font-semibold text-gray-400">bookSys</span>
          </div>
        </div>
      </div>
    </div>
  );
}
