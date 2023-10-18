import { BaseSyntheticEvent, FC, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { Button } from '../../components/Button/Button';
import { useFeedback } from '../../api/feedback/useFeedback';

export const Feedback: FC = () => {
  const [feedbackText, setFeedbackText] = useState('');
  const { sendFeedback } = useFeedback();

  const onSubmitFeedback = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    sendFeedback({ feedback: feedbackText }).then(() => {
      setFeedbackText('');
    });
  };

  return (
    <Container style={{ maxWidth: 960 }} className="my-4 feedback">
      <Row className="mb-2">
        <Col>
          <h2 className="px-2 mb-4">Feedback</h2>
        </Col>
      </Row>
      <Row className="px-2">
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
