import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { VehicleDetail, VehicleInput } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, Field, PageTitle, Spinner, inputClass } from '../components/ui';
import { label } from '../lib/format';
import { BODY_TYPES, CONDITIONS, FUEL_TYPES, REGIONS, TRANSMISSIONS } from '../lib/regions';

const MAX_PHOTOS = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const empty: VehicleInput = {
  title: '', make: '', model: '', year: new Date().getFullYear() - 5, price_tzs: 0, mileage_km: 0,
  fuel_type: 'petrol', transmission: 'automatic', engine_cc: null, body_type: 'sedan', condition: 'used',
  color: '', region: 'Dar es Salaam', city: '', description: '', contact_phone: '', whatsapp_number: '',
};

export default function ListingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<VehicleInput>(empty);
  const [loading, setLoading] = useState(editing);
  const [existing, setExisting] = useState<VehicleDetail | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!editing) {
      setForm((current) => ({
        ...current,
        contact_phone: user?.phone ?? '',
        whatsapp_number: user?.phone ?? '',
        region: user?.region || current.region,
        city: user?.city ?? '',
      }));
      return;
    }
    endpoints
      .getVehicle(Number(id))
      .then((vehicle) => {
        setExisting(vehicle);
        setForm({
          title: vehicle.title, make: vehicle.make, model: vehicle.model, year: vehicle.year,
          price_tzs: vehicle.price_tzs, mileage_km: vehicle.mileage_km, fuel_type: vehicle.fuel_type,
          transmission: vehicle.transmission, engine_cc: vehicle.engine_cc, body_type: vehicle.body_type,
          condition: vehicle.condition, color: vehicle.color, region: vehicle.region, city: vehicle.city,
          description: vehicle.description, contact_phone: vehicle.contact_phone, whatsapp_number: vehicle.whatsapp_number,
        });
      })
      .catch((err) => setFormError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [editing, id, user]);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  if (loading) return <Spinner label="Loading listing" />;

  function set<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function textInput(key: keyof VehicleInput) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, event.target.value as never);
  }

  function numberInput(key: keyof VehicleInput, allowEmpty = false) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      set(key, (allowEmpty && raw === '' ? null : Number(raw)) as never);
    };
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    const existingCount = existing?.images.length ?? 0;
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!ALLOWED.includes(file.type)) problems.push(`${file.name}: use JPEG, PNG or WebP.`);
      else if (file.size > MAX_BYTES) problems.push(`${file.name}: keep each photo under 5 MB.`);
      else accepted.push(file);
    }
    const room = MAX_PHOTOS - existingCount - files.length;
    if (accepted.length > room) problems.push(`You can add ${Math.max(room, 0)} more photo(s), up to ${MAX_PHOTOS} in total.`);
    setErrors((current) => ({ ...current, photos: problems.join(' ') }));
    setFiles((current) => [...current, ...accepted.slice(0, Math.max(room, 0))]);
  }

  async function removeExisting(imageId: number) {
    if (!existing) return;
    try {
      const updated = await endpoints.deleteVehicleImage(existing.id, imageId);
      setExisting({ ...existing, images: updated.images });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  function validate(): Record<string, string> {
    const problems: Record<string, string> = {};
    if (!form.title.trim()) problems.title = 'Give the advert a title, e.g. “Toyota Prado TX 2016”.';
    if (!form.make.trim()) problems.make = 'Enter the manufacturer.';
    if (!form.model.trim()) problems.model = 'Enter the model.';
    if (!form.price_tzs || form.price_tzs < 100000) problems.price_tzs = 'Enter a price of at least TZS 100,000.';
    if (!form.contact_phone.trim()) problems.contact_phone = 'A contact number is required so buyers can reach you.';
    if (form.description.trim().length < 20) problems.description = 'Describe the vehicle in at least 20 characters.';
    return problems;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems = validate();
    setErrors((current) => ({ ...problems, photos: current.photos }));
    setFormError('');
    setNotice('');
    if (Object.keys(problems).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      if (editing && existing) {
        await endpoints.updateVehicle(existing.id, form);
        if (files.length) await endpoints.uploadVehicleImages(existing.id, files);
        navigate(`/vehicles/${existing.id}`, { state: { flash: 'Changes saved. Material changes are reviewed again before going live.' } });
      } else {
        const created = await endpoints.createVehicle(form, files);
        navigate(`/vehicles/${created.id}`, { state: { flash: 'Thanks! Your listing is with our team for review. We will notify you once it is live.' } });
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const inputError = (key: string) => errors[key];
  const required = <span className="text-red-600" aria-hidden="true"> *</span>;

  return (
    <>
      <PageTitle
        title={editing ? 'Edit listing' : 'Publish a vehicle'}
        subtitle="Clear photos and an honest description sell faster. Listings are reviewed before they go live."
      />
      {notice && <Alert tone="info">{notice}</Alert>}
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {formError && <Alert tone="error">{formError}</Alert>}

          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Vehicle</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Advert title" htmlFor="l-title" error={inputError('title')} className="sm:col-span-2">
                <input id="l-title" className={inputClass} value={form.title} onChange={textInput('title')} maxLength={150} placeholder="Toyota Land Cruiser Prado TX 2016" aria-required="true" />
              </Field>
              <Field label="Make" htmlFor="l-make" error={inputError('make')}>
                <input id="l-make" className={inputClass} value={form.make} onChange={textInput('make')} placeholder="Toyota" aria-required="true" />
              </Field>
              <Field label="Model" htmlFor="l-model" error={inputError('model')}>
                <input id="l-model" className={inputClass} value={form.model} onChange={textInput('model')} placeholder="Land Cruiser Prado" aria-required="true" />
              </Field>
              <Field label="Year" htmlFor="l-year">
                <input id="l-year" type="number" className={inputClass} value={form.year} onChange={numberInput('year')} min={1950} />
              </Field>
              <Field label="Condition" htmlFor="l-condition">
                <select id="l-condition" className={inputClass} value={form.condition} onChange={textInput('condition')}>
                  {CONDITIONS.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
              </Field>
              <Field label="Asking price (TZS)" htmlFor="l-price" error={inputError('price_tzs')}>
                <input id="l-price" type="number" className={inputClass} value={form.price_tzs || ''} onChange={numberInput('price_tzs')} min={0} step={100000} aria-required="true" />
              </Field>
              <Field label="Mileage (km)" htmlFor="l-mileage">
                <input id="l-mileage" type="number" className={inputClass} value={form.mileage_km || ''} onChange={numberInput('mileage_km')} min={0} />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Specifications</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fuel" htmlFor="l-fuel">
                <select id="l-fuel" className={inputClass} value={form.fuel_type} onChange={textInput('fuel_type')}>
                  {FUEL_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
              </Field>
              <Field label="Transmission" htmlFor="l-gear">
                <select id="l-gear" className={inputClass} value={form.transmission} onChange={textInput('transmission')}>
                  {TRANSMISSIONS.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
              </Field>
              <Field label="Engine (cc)" htmlFor="l-cc" hint="Leave blank if unknown">
                <input id="l-cc" type="number" className={inputClass} value={form.engine_cc ?? ''} onChange={numberInput('engine_cc', true)} min={50} />
              </Field>
              <Field label="Body type" htmlFor="l-body">
                <select id="l-body" className={inputClass} value={form.body_type} onChange={textInput('body_type')}>
                  {BODY_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
              </Field>
              <Field label="Colour" htmlFor="l-color">
                <input id="l-color" className={inputClass} value={form.color} onChange={textInput('color')} />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Location and contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Region" htmlFor="l-region">
                <select id="l-region" className={inputClass} value={form.region} onChange={textInput('region')}>
                  {REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="City or area" htmlFor="l-city">
                <input id="l-city" className={inputClass} value={form.city} onChange={textInput('city')} placeholder="Masaki, Arusha City…" />
              </Field>
              <Field label="Phone number" htmlFor="l-phone" error={inputError('contact_phone')} hint="Shown to buyers. Tanzanian mobile number.">
                <input id="l-phone" type="tel" className={inputClass} value={form.contact_phone} onChange={textInput('contact_phone')} aria-required="true" />
              </Field>
              <Field label="WhatsApp number (optional)" htmlFor="l-wa">
                <input id="l-wa" type="tel" className={inputClass} value={form.whatsapp_number} onChange={textInput('whatsapp_number')} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Description" htmlFor="l-desc" error={inputError('description')} hint="Service history, extras, reason for selling, documents you hold.">
                <textarea id="l-desc" rows={6} maxLength={3000} className={inputClass} value={form.description} onChange={textInput('description')} />
              </Field>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <h2 className="font-semibold text-slate-900">Photos{required}</h2>
            <p className="mt-1 text-xs text-slate-500">Up to {MAX_PHOTOS} photos, 5 MB each. JPEG, PNG or WebP. The first photo is the main one.</p>
            {existing && existing.images.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Current photos">
                {existing.images.map((image) => (
                  <li key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                    <button type="button" aria-label="Remove this photo" onClick={() => removeExisting(image.id)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-700 shadow">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {previews.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="Photos to upload">
                {previews.map((item, index) => (
                  <li key={item.url} className="relative aspect-square overflow-hidden rounded-lg ring-2 ring-brand-500">
                    <img src={item.url} alt={`New photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button type="button" aria-label={`Remove new photo ${index + 1}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-700 shadow">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 hover:border-brand-500 hover:bg-brand-50/40 focus-within:ring-2 focus-within:ring-brand-500">
              <ImagePlus className="h-7 w-7 text-brand-600" aria-hidden="true" />
              <span className="font-semibold text-slate-800">Add photos</span>
              <span className="text-xs">Select one or more files</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={addFiles} />
            </label>
            {errors.photos && <p className="mt-2 text-xs text-red-700" role="alert">{errors.photos}</p>}
          </Card>

          <Card>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish for review'}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              By publishing you confirm the details are accurate and that you have the right to sell this vehicle.
            </p>
          </Card>
        </aside>
      </form>
    </>
  );
}
