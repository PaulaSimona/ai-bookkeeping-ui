import { FC, useEffect, useMemo, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import './BuyAdditionalStorageSpace.scss';
import { Button } from '../../../components/Button/Button';
import { usePackage } from '../../../api/packages/usePackage';
import { PackageType } from '../../../store/features/packageSlice';
import { usePayments } from '../../../api/payments/usePayments';
import { CardIcon } from '../../../components/Icons/CardIcon';
import { useProfile } from '../../../api/user/useProfile';
import { get_gst, get_hst, get_pst, get_qst } from '../../../utils/taxes';
import { round } from '../../../utils/round';
import { useBuyPackage } from '../../../api/packages/useBuyPackage';
import { LinkButton } from '../../../components/Button/ButtonLink';

interface BuyStorageType {
  onSuccess: () => void;
}

export const BuyAdditionalStorageSpace: FC<BuyStorageType> = ({
  onSuccess,
}) => {
  const { buyPackage } = useBuyPackage();
  const { packages } = usePackage();
  const { paymentsMethods, getPayments } = usePayments();
  const { profile, getProfile } = useProfile();
  const paymentMethodEmpty = useMemo(
    () => paymentsMethods.length === 0,
    [paymentsMethods],
  );

  const [selected, setSelected] = useState<PackageType | null>(null);
  const [showChangePaymentMethod, setShowChangePaymentMethod] = useState(false);
  const [loading, setLoading] = useState(false);

  // TAXES and TOTAL variables
  const gst = useMemo(() => {
    return get_gst(selected?.price || 0, profile?.company_province || '');
  }, [selected, profile]);
  const pst = useMemo(() => {
    return get_pst(selected?.price || 0, profile?.company_province || '');
  }, [selected, profile]);
  const hst = useMemo(() => {
    return get_hst(selected?.price || 0, profile?.company_province || '');
  }, [selected, profile]);
  const qst = useMemo(() => {
    return get_qst(selected?.price || 0, profile?.company_province || '');
  }, [selected, profile]);
  const total = useMemo(() => {
    if (!selected) return 0;
    return selected?.price + gst + pst + hst + qst;
  }, [selected, gst, pst, hst, qst]);

  // payment methods selected, by default is primaryPaymentMethod
  const primaryPaymentMethod = useMemo(
    () => paymentsMethods.find((p) => p.is_primary),
    [paymentsMethods],
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);

  // When user click on Place your order button
  const onPlaceYourOrder = () => {
    setLoading(true);
    const packageId = selected?.id;
    const paymentMethodId =
      selectedPaymentMethod?.id || primaryPaymentMethod?.id;
    buyPackage(packageId, paymentMethodId).then((response) => {
      if (response.status === 201) {
        onSuccess();
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (selected == null && packages?.length > 0) {
      setSelected(packages[0]);
      if (paymentsMethods.length === 0) {
        getPayments();
      }
    }
  }, [packages, paymentsMethods, getPayments, selected]);
  useEffect(() => {
    if (!profile) {
      getProfile();
    }
  }, [getProfile, profile]);

  // When user select a payment method
  const onSelectPaymentMethod = (paymentMethod: any) => {
    setSelectedPaymentMethod(paymentMethod);
    setShowChangePaymentMethod(false);
  };

  // Display the list of payment methods when user select change payment method
  if (showChangePaymentMethod) {
    return (
      <div className="buy_more_space p-4">
        <a
          href="#"
          onClick={() => {
            setShowChangePaymentMethod(false);
          }}
        >
          <i className="fas fa-arrow-left"></i> Back
        </a>
        <div className="mt-4">Select a payment method</div>
        <div className="mt-4">
          {paymentsMethods.map((paymentMethod) => (
            <div
              className="payment-method-card d-flex"
              onClick={() => {
                onSelectPaymentMethod(paymentMethod);
              }}
            >
              <div>
                <CardIcon card={paymentMethod.card_brand} />
              </div>
              <div className="payment-method-card-item left">
                ****{paymentMethod.card_last4}
              </div>
              <div className="payment-method-card-item center">
                {paymentMethod.card_brand}
              </div>
              <div className="payment-method-card-item right">
                {paymentMethod.name_payment_method}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="buy_more_space p-4">
      <div>
        {packages?.map((pack: PackageType) => (
          <div className="d-flex buy_more_space_item py-2" key={pack.id}>
            <div className="mr-4">
              Additional {pack.number_of_documents} documents (up to{' '}
              {pack.storage_space}MB) for $ {pack.price}
            </div>
            <div>
              <Form.Check
                type="radio"
                name="package"
                id={`package-${pack.id}`}
                checked={selected?.id === pack.id}
                onChange={() => setSelected(pack)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h4>Total Invoice</h4>

        <div className="d-flex justify-content-between">
          <div>
            <strong>Selected:</strong>
          </div>
          <div>$ {selected?.price}</div>
        </div>

        <div className="mt-2">
          {pst != 0 && (
            <div className="d-flex justify-content-between">
              <strong>PST:</strong>
              <span>$ {round(pst)}</span>
            </div>
          )}
          {qst != 0 && (
            <div className="d-flex justify-content-between">
              <strong>QST:</strong>
              <span>$ {round(qst)}</span>
            </div>
          )}
          {gst != 0 && (
            <div className="d-flex justify-content-between">
              <strong>GST:</strong>
              <span>$ {round(gst)}</span>
            </div>
          )}
          {hst != 0 && (
            <div className="d-flex justify-content-between">
              <strong>HST:</strong>
              <span>$ {round(hst)}</span>
            </div>
          )}
        </div>

        <div className="d-flex justify-content-between mt-2">
          <div>
            <strong>Total:</strong>
          </div>
          <div>$ {round(total)}</div>
        </div>
      </div>

      <hr />

      <div className="mt-2">
        <h4>Payment method:</h4>
        {paymentsMethods.length > 0 && (
          <div className="d-flex justify-content-between">
            {selectedPaymentMethod && (
              <div>
                Paying with my {selectedPaymentMethod?.card_brand} Card ****
                {selectedPaymentMethod?.card_last4}
              </div>
            )}
            {primaryPaymentMethod && !selectedPaymentMethod && (
              <div>
                Paying with my {primaryPaymentMethod?.card_brand} Card ****
                {primaryPaymentMethod?.card_last4}
              </div>
            )}
            <div>
              <a
                href="#"
                onClick={() => {
                  setShowChangePaymentMethod(true);
                }}
              >
                Change
              </a>
            </div>
          </div>
        )}
        {paymentsMethods.length === 0 && (
          <div>
            <Alert variant="secondary">
              <div className="text-center">
                <div>You don't have any payment method registered.</div>
                <div className="mt-2">
                  <LinkButton
                    to="/billing"
                    variant="primary"
                    value="Add a payment method"
                  />
                </div>
              </div>
            </Alert>
          </div>
        )}
      </div>

      <div className="mt-4 d-flex flex-row-reverse">
        <Button
          value={loading ? 'Ordering...' : 'Place your Order'}
          onClick={onPlaceYourOrder}
          disabled={loading || paymentMethodEmpty}
        />
      </div>
    </div>
  );
};
