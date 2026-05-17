// @ts-nocheck
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { BaseSyntheticEvent, useState } from 'react';
import api from '../../utils/api';
import { Button } from '../Button/Button';
import { Form } from 'react-bootstrap';

const CheckoutForm = () => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  // Handle real-time validation errors from the CardElement.

  const handleChange = (event: any) => {
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };
  // Handle form submission.
  const handleSubmit = async (event: BaseSyntheticEvent) => {
    event.preventDefault();
    if (elements == null || stripe == null) return;

    setLoading(true);

    const card = elements.getElement(CardElement);

    if (card) {
      const { paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: card,
      });

      if (paymentMethod) {
        api
          .post('/api/payments/save-stripe-info', {
            payment_method_id: paymentMethod.id,
          })
          .then((response) => {
            console.log(response.data);
          })
          .catch((error) => {
            console.log(error);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="stripe-form">
      <div className="form-row">
        <label htmlFor="card-element">Credit or debit card</label>
        <CardElement id="card-element" onChange={handleChange} />
        {/* <PaymentElement id="card-element" onChange={handleChange}/> */}
        <div className="card-errors" role="alert">
          {error}
        </div>
      </div>
      <div className="mt-4 d-flex flex-row-reverse">
        <Button type="submit" value="Submit Payment" disabled={loading} />
      </div>
    </Form>
  );
};
export default CheckoutForm;
