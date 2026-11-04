"use client";

import { useState } from "react";
import { Crosshair, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MapShell } from "@/components/maps/map-shell";

type AddressFields = {
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
};

type Props = {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: Partial<AddressFields>;
  errors?: Record<string, string>;
};

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

export function LocationPicker({ initialLat, initialLng, initialAddress, errors }: Props) {
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [center, setCenter] = useState<[number, number]>(
    initialLat != null && initialLng != null ? [initialLng, initialLat] : DEFAULT_CENTER,
  );
  const [address, setAddress] = useState<AddressFields>({
    addressStreet: initialAddress?.addressStreet ?? "",
    addressCity: initialAddress?.addressCity ?? "",
    addressState: initialAddress?.addressState ?? "",
    addressPostalCode: initialAddress?.addressPostalCode ?? "",
    addressCountry: initialAddress?.addressCountry ?? "US",
  });
  const [geocoding, setGeocoding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const update = (key: keyof AddressFields) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setAddress((current) => ({ ...current, [key]: event.target.value }));
  };

  const setPin = (nextLat: number, nextLng: number, recenter = false) => {
    setLat(nextLat);
    setLng(nextLng);
    if (recenter) setCenter([nextLng, nextLat]);
  };

  const findAddress = async () => {
    const query = [
      address.addressStreet,
      address.addressCity,
      address.addressState,
      address.addressPostalCode,
      address.addressCountry,
    ]
      .filter(Boolean)
      .join(", ");
    if (!query) {
      setLookupError("Enter an address first");
      return;
    }
    setGeocoding(true);
    setLookupError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/geocode?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.result) {
        setLookupError(data.error ?? "We could not find that address. Drop a pin instead.");
        return;
      }
      setPin(Number(data.result.lat), Number(data.result.lng), true);
      setMessage(`Found: ${data.result.label}`);
    } catch {
      setLookupError("Geocoding is unavailable. Drop a pin on the map instead.");
    } finally {
      setGeocoding(false);
    }
  };

  const fillFromPin = async () => {
    if (lat == null || lng == null) return;
    setGeocoding(true);
    setLookupError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/geocode/reverse?lat=${lat}&lng=${lng}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.result) {
        setLookupError(data.error ?? "No address found near that pin.");
        return;
      }
      const result = data.result as {
        label?: string;
        address?: Partial<AddressFields>;
      };
      setAddress((current) => ({
        addressStreet: result.address?.addressStreet || current.addressStreet,
        addressCity: result.address?.addressCity || current.addressCity,
        addressState: result.address?.addressState || current.addressState,
        addressPostalCode: result.address?.addressPostalCode || current.addressPostalCode,
        addressCountry: result.address?.addressCountry || current.addressCountry,
      }));
      setMessage(result.label ? `Address: ${result.label}` : "Address filled from pin");
    } catch {
      setLookupError("Reverse geocoding is unavailable.");
    } finally {
      setGeocoding(false);
    }
  };

  const markers =
    lat != null && lng != null
      ? [
          {
            id: "pin",
            lat,
            lng,
            label: "Task location",
            kind: "pin" as const,
            draggable: true,
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Street address"
          htmlFor="addressStreet"
          error={errors?.addressStreet}
          required
          className="sm:col-span-2"
        >
          <Input
            id="addressStreet"
            name="addressStreet"
            value={address.addressStreet}
            onChange={update("addressStreet")}
            autoComplete="street-address"
            required
          />
        </Field>
        <Field label="City" htmlFor="addressCity" error={errors?.addressCity} required>
          <Input
            id="addressCity"
            name="addressCity"
            value={address.addressCity}
            onChange={update("addressCity")}
            autoComplete="address-level2"
            required
          />
        </Field>
        <Field label="State / region" htmlFor="addressState" error={errors?.addressState} required>
          <Input
            id="addressState"
            name="addressState"
            value={address.addressState}
            onChange={update("addressState")}
            autoComplete="address-level1"
            required
          />
        </Field>
        <Field label="Postal code" htmlFor="addressPostalCode" error={errors?.addressPostalCode}>
          <Input
            id="addressPostalCode"
            name="addressPostalCode"
            value={address.addressPostalCode}
            onChange={update("addressPostalCode")}
            autoComplete="postal-code"
          />
        </Field>
        <Field label="Country" htmlFor="addressCountry" error={errors?.addressCountry} required>
          <Input
            id="addressCountry"
            name="addressCountry"
            value={address.addressCountry}
            onChange={update("addressCountry")}
            autoComplete="country-name"
            required
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={findAddress} disabled={geocoding}>
          <Search className="size-4" aria-hidden />
          {geocoding ? "Looking up…" : "Find address on map"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={fillFromPin}
          disabled={geocoding || lat == null || lng == null}
        >
          <LocateFixed className="size-4" aria-hidden />
          Fill address from pin
        </Button>
      </div>

      {message ? <p className="text-xs text-success">{message}</p> : null}
      {lookupError ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {lookupError}
        </p>
      ) : null}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            Map pin <span className="text-destructive">*</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Crosshair className="size-3.5" aria-hidden />
            Tap the map or drag the pin
          </span>
        </div>
        <MapShell
          center={center}
          zoom={lat != null ? 14 : 12}
          markers={markers}
          className="h-64 sm:h-80"
          onMapClick={(nextLat, nextLng) => {
            setPin(nextLat, nextLng);
            setMessage(null);
          }}
          onMarkerDrag={(_, nextLat, nextLng) => setPin(nextLat, nextLng)}
          ariaLabel="Task location picker"
        />
        <input type="hidden" name="lat" value={lat ?? ""} />
        <input type="hidden" name="lng" value={lng ?? ""} />
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {lat != null && lng != null
            ? `Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : "No pin selected yet"}
        </p>
        {errors?.lat || errors?.lng ? (
          <p className="mt-1 text-xs font-medium text-destructive" role="alert">
            {errors?.lat ?? errors?.lng}
          </p>
        ) : null}
      </div>
    </div>
  );
}
