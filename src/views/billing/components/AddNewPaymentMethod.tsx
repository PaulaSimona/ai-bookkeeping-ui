import { BaseSyntheticEvent, FC, useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Form } from 'react-bootstrap';
import { Button } from '../../../components/Button/Button';
import { FormInput } from '../../../components/Form/FormInput';
import { usePayments } from '../../../api/payments/usePayments';

interface AddNewPaymentMethod {
  handleOnClose: () => any;
}

export const AddNewPaymentMethod: FC<AddNewPaymentMethod> = ({
  handleOnClose,
}) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string[]>([]);
  const stripe = useStripe();
  const elements = useElements();
  const { createPaymentMethod, getPayments } = usePayments();

  const handleChange = (event: any) => {
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const options = {
    style: {
      base: {
        fontSize: '1.2rem',
      },
    },
  };

  const handleSubmit = async (event: BaseSyntheticEvent) => {
    event.preventDefault();

    // control required fields
    if (name === '') {
      setNameError(['Name is required']);
      return;
    }
    setNameError([]);

    // control stripe
    if (elements == null || stripe == null) return;

    setLoading(true);

    // create payment method
    const card = elements.getElement(CardElement);

    if (card) {
      const { paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: card,
      });

      if (paymentMethod) {
        createPaymentMethod({
          payment_method_id: paymentMethod.id,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4,
          card_exp_month: paymentMethod.card?.exp_month,
          card_exp_year: paymentMethod.card?.exp_year,
          name_payment_method: name,
        })
          .then((response) => {
            if (response) {
              setName('');
              getPayments();
              handleOnClose();
            }
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  };

  return (
    <div className="p-2">
      <Form onSubmit={handleSubmit} className="stripe-form">
        <div className="form-row">
          <div className="mb-4">
            <FormInput
              type="text"
              fieldName="name"
              label="Name of Payment Method"
              name="cardholder_name"
              value={name}
              onChange={(e: BaseSyntheticEvent) => {
                setName(e.target.value);
              }}
              placeholder="Name of Payment Method"
              errors={nameError}
            />
          </div>
          <label htmlFor="card-element">Credit or debit card</label>
          <div>
            <CardElement
              id="card-element"
              onChange={handleChange}
              options={options}
            />
          </div>
          <div className="card-errors" role="alert">
            {error}
          </div>
        </div>
        <div className="mt-4 d-flex flex-row-reverse">
          <div style={{ paddingLeft: '1rem' }}>
            <Button
              type="submit"
              value="Add new payment method"
              disabled={loading}
            />
          </div>
          <div className="mr-4">
            <Button
              value="Cancel"
              variant="secondary"
              onClick={handleOnClose}
            />
          </div>
        </div>
      </Form>
    </div>
  );
};
