import { type BaseSyntheticEvent, type FC } from 'react';
import { Form } from 'react-bootstrap';

interface OptionType {
  label: string;
  value: string | number;
}

interface FormSelectType {
  fieldName: string;
  value: string | number;
  options: OptionType[];
  errors: string[];
  label?: string;
  onChange: (e: BaseSyntheticEvent) => any;
  placeholder?: string;
  classes?: string;
}

/**
 * @param {string} label show label text
 * @param {string} fieldName value used for id and key from data object
 * @param {string} placeholder show default value
 * @param {string} value input Input
 * @param {function} onChange event for change value
 * @param {[string]} errors array of strings to show errors
 * @param {string} classes classes names
 */
export const FormSelect: FC<FormSelectType> = ({
  label = '',
  fieldName,
  value,
  options,
  placeholder,
  onChange,
  errors,
  classes,
}) => (
  <Form.Group className={classes}>
    {!!label && <Form.Label column>{label}</Form.Label>}
    <Form.Select
      key={fieldName}
      name={fieldName}
      id={fieldName}
      value={value}
      onChange={onChange}
      isInvalid={errors.length > 0}
    >
      {placeholder && <option>{placeholder}</option>}
      {options.map((option: OptionType) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Form.Select>
    <Form.Control.Feedback id={`${fieldName}_errors`} type="invalid">
      <ul>
        {errors.map((errorValue) => (
          <li key={`${fieldName}_${errorValue}`}>{errorValue}</li>
        ))}
      </ul>
    </Form.Control.Feedback>
  </Form.Group>
);
