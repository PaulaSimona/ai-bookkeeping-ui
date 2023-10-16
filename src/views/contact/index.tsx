import { BaseSyntheticEvent, FC, useState } from 'react';
import { Container, Form } from 'react-bootstrap';
import { Button } from '../../components/Button/Button';
import { useContact } from '../../api/contact/useContact';

type contactType = {
  subject: string;
  message: string;
};

export const Contact: FC = () => {
  const [contactData, setContactData] = useState<contactType>({
    subject: '',
    message: '',
  });
  const { sendMail } = useContact();

  const onSubmitMessage = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    sendMail(contactData).then(() => {
      setContactData({
        subject: '',
        message: '',
      });
    });
  };

  return (
    <Container style={{ maxWidth: 960 }} className="my-4">
      <div className="pb-4">
        <h1>Contact us</h1>
      </div>
      <p className="mt-4">
        <div className="mb-4">
          <strong>Email:</strong>{' '}
          <a href="mailto:customerservice@ai-bookkeeping.ai">
            customerservice@ai-bookkeeping.ai
          </a>
        </div>
        <Form style={{ maxWidth: 700 }} onSubmit={onSubmitMessage}>
          <Form.Group className="mb-3" controlId="exampleForm.ControlTextarea1">
            {/* <Form.Label>Subject</Form.Label> */}
            <Form.Control
              placeholder="subject"
              value={contactData.subject}
              onChange={(e: BaseSyntheticEvent) =>
                setContactData((c) => ({ ...c, subject: e.target.value }))
              }
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="exampleForm.ControlTextarea1">
            {/* <Form.Label>Message</Form.Label> */}
            <Form.Control
              as="textarea"
              placeholder="Email Body"
              rows={7}
              value={contactData.message}
              onChange={(e: BaseSyntheticEvent) =>
                setContactData((c) => ({ ...c, message: e.target.value }))
              }
            />
            <div className="mt-4">
              <div style={{ maxWidth: 200, float: 'right' }}>
                <Form.Control as={Button} type="submit" value="Submit" />
              </div>
            </div>
          </Form.Group>
        </Form>
      </p>
    </Container>
  );
};
