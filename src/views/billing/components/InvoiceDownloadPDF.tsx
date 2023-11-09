import { FC, useMemo } from 'react';
import { InvoiceType } from '../../../store/features/billingSlice';
import { Margin, usePDF } from 'react-to-pdf';
import { Button } from '../../../components/Button/Button';
import { formatDateTime } from '../../../utils/dates';
import { round } from '../../../utils/round';

type InvoiceDownloadPDFType = {
  invoice: InvoiceType | null;
  onClose: () => void;
};

export const InvoiceDownloadPDF: FC<InvoiceDownloadPDFType> = ({
  invoice,
  onClose,
}) => {
  const dateString = useMemo(() => {
    if (!invoice) return '';
    return formatDateTime(invoice.created_at);
  }, [invoice]);
  const { toPDF, targetRef } = usePDF({
    filename: `invoice_${invoice?.created_at}_${invoice?.id.split('-')[0]}.pdf`,
    page: { margin: Margin.MEDIUM },
  });

  if (!invoice) {
    return <div>loading...</div>;
  }

  return (
    <div className="invoice">
      <div ref={targetRef} className="pb-4">
        <h3>Invoice</h3>
        <p>{dateString}</p>
        <hr />
        <p>{invoice.description}</p>
        <hr />

        {invoice.items.map((item) => (
          <div key={item.name} className="d-flex justify-content-between">
            <div>
              <strong>{item.name}</strong>
            </div>
            <div>${item.price}</div>
          </div>
        ))}
        <hr />

        {!!invoice.hst && (
          <div className="d-flex justify-content-between">
            <div>
              <strong>HST</strong>
            </div>
            <div>${round(invoice.hst)}</div>
          </div>
        )}
        {!!invoice.pst && (
          <div className="d-flex justify-content-between">
            <div>
              <strong>PST</strong>
            </div>
            <div>${round(invoice.pst)}</div>
          </div>
        )}
        {!!invoice.qst && (
          <div className="d-flex justify-content-between">
            <div>
              <strong>QST</strong>
            </div>
            <div>${round(invoice.qst)}</div>
          </div>
        )}
        {!!invoice.gst && (
          <div className="d-flex justify-content-between">
            <div>
              <strong>GST</strong>
            </div>
            <div>${round(invoice.gst)}</div>
          </div>
        )}

        <div className="d-flex justify-content-between">
          <div>
            <strong>total:</strong>
          </div>
          <div>${round(invoice.amount)}</div>
        </div>
      </div>

      <div className="d-flex justify-content-end">
        <div className="mx-2">
          <Button value="Cancel" variant="secondary" onClick={onClose} />
        </div>
        <div>
          <Button value="Download PDF" icon="download" onClick={toPDF} />
        </div>
      </div>
    </div>
  );
};
