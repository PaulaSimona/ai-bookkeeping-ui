import { FC } from 'react';
import { Container } from 'react-bootstrap';

export const Contact: FC = () => {
  return (
    <Container style={{ maxWidth: 960 }} className="my-4">
      <div className="pb-4">
        <h1>Contact us</h1>
      </div>
      <p className="mt-4">
        <strong>Email:</strong>{' '}
        <a href="mailto:customerservice@ai-bookkeeping.ai">
          customerservice@ai-bookkeeping.ai
        </a>
      </p>
    </Container>
  );
};
