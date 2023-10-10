import { BaseSyntheticEvent, FC, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { Button } from '../../components/Button/Button';

export const Feedback: FC = () => {
  const [feedbackText, setFeedbackText] = useState('');

  const onSubmitFeedback = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    console.log('onSubmit', feedbackText);
  };
  return (
    <Container>
      <Row className="mb-2">
        <Col>
          <h2>Feedback</h2>
        </Col>
      </Row>
      <Row>
        <Form onSubmit={onSubmitFeedback} style={{ maxWidth: 750 }}>
          <Form.Group className="mb-3" controlId="exampleForm.ControlTextarea1">
            <Form.Label>Let us know how could improve</Form.Label>
            <Form.Control
              as="textarea"
              placeholder="your opinion..."
              rows={7}
              value={feedbackText}
              onChange={(e: BaseSyntheticEvent) =>
                setFeedbackText(e.target.value)
              }
            />
            <div className="mt-4" style={{ maxWidth: 200 }}>
              <Form.Control as={Button} type="submit" value="Submit" />
            </div>
          </Form.Group>
        </Form>
      </Row>
    </Container>
  );
};
