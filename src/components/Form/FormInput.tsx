// @ts-nocheck
import { type BaseSyntheticEvent, type FC } from 'react';
import { Form } from 'react-bootstrap';

interface FormInputType {
  placeholder: string;
  fieldName: string;
  value: string | number;
  onChange: (e: BaseSyntheticEvent) => any;
  label?: string;
  errors?: string[];
  classes?: string;
  type?: string;
  [k: string]: any;
}

/**
 * @param {string} label show label text
 * @param {string} fieldName value used for id and key from data object
 * @param {string} placeholder show placeholder text
 * @param {string} value input Input
 * @param {function} onChange event for change value
 * @param {[string]} errors array of strings to show errors
 * @param {string} classes classes names
 * @param {string} type input type
 */
export const FormInput: FC<FormInputType> = ({
  fieldName,
  value,
  placeholder,
  onChange,
  label,
  errors,
  classes,
  type,
  ...props
}) => (
  <Form.Group className={classes}>
    {label && <Form.Label column>{label}</Form.Label>}
    <Form.Control
      key={fieldName}
      name={fieldName}
      id={fieldName}
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={onChange}
      isInvalid={errors != null && errors.length > 0}
      {...props}
    />
    <Form.Control.Feedback id={`${fieldName}_errors`} type="invalid">
      <ul>
        {errors?.map((errorValue) => (
          <li key={`${fieldName}_${errorValue}`}>{errorValue}</li>
        ))}
      </ul>
    </Form.Control.Feedback>
  </Form.Group>
);

FormInput.defaultProps = {
  label: '',
  errors: [],
  classes: '',
  type: 'text',
};
