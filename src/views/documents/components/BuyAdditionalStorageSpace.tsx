import { FC, useState } from 'react';
import { Form } from 'react-bootstrap';
import './BuyAdditionalStorageSpace.scss';
import { Button } from '../../../components/Button/Button';
import { usePackage } from '../../../api/packages/usePackage';
import { PackageType } from '../../../store/features/packageSlice';

interface BuyStorageType {
  onClickButton: () => void;
}

export const BuyAdditionalStorageSpace: FC<BuyStorageType> = ({
  onClickButton,
}) => {
  const { packages } = usePackage();
  const [selected, setSelected] = useState<PackageType | null>(null);

  const onPlaceYourOrder = () => {
    console.log('onPlaceYourOrder');
    onClickButton();
  };

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

      <div className="mt-2">
        <div>PST / QST</div>
        <div>GST / HST</div>
      </div>

      <hr />

      <div className="mt-2">
        <h4>Total Invoice</h4>
        <div className="d-flex justify-content-between">
          <div>Total:</div>
          <div>$ {selected?.price}</div>
        </div>
      </div>

      <hr />

      <div className="mt-2">
        <h4>Payment method:</h4>
        <div className="d-flex justify-content-between">
          <div>Paying with my Visa Card 1089</div>
          <div>
            <a href="#">Change</a>
          </div>
        </div>
      </div>

      <div className="mt-4 d-flex flex-row-reverse">
        <Button value="Place your Order" onClick={onPlaceYourOrder} />
      </div>
    </div>
  );
};
