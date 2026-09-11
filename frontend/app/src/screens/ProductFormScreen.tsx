import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import {
  listCategories,
  listSubcategories,
  getProduct,
  createProduct,
  updateProduct,
  uploadProductImage,
  AdminCategory,
  AdminSubcategory,
  ChannelVisibility,
  TrackingMode,
} from '../api/catalog';
import { listPieces, Piece, scanLookup } from '../api/inventory';
import { ClaimSet } from '../utils/concurrencyGuards';
import { normalizeBarcode } from '../utils/barcode';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import SearchablePicker from '../components/SearchablePicker';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import BarcodeScanModal from '../components/BarcodeScanModal';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FilterChip } from '../components/ui/Chip';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ProductForm'>;

const VISIBILITY_OPTIONS: { value: ChannelVisibility; label: string }[] = [
  { value: 'both', label: 'Online + Store' },
  { value: 'online_only', label: 'Online only' },
  { value: 'store_only', label: 'Store only' },
];

export default function ProductFormScreen({ route, navigation }: Props) {
  const initialProductId = route.params?.productId;
  const { accessToken } = useAuth();

  const [productId, setProductId] = useState<string | undefined>(initialProductId);
  const isEdit = Boolean(productId);

  const [loading, setLoading] = useState(Boolean(initialProductId));
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [subcategories, setSubcategories] = useState<AdminSubcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [subcategoryPickerOpen, setSubcategoryPickerOpen] = useState(false);
  const [channelVisibility, setChannelVisibility] = useState<ChannelVisibility>('both');
  // No picker for this anymore (removed with "Stock display") — every new
  // product is barcode-tracked by default, matching the receive-stock flow.
  // Editing an older quantity-mode product still loads and keeps its real
  // value below.
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('serialized');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [sku, setSku] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loadingPieces, setLoadingPieces] = useState(false);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  // Lets staff scan/type this product's first unit(s) while still creating
  // it, instead of forcing a separate "Scan Barcode" trip right afterward —
  // held locally, then sent as part of the createProduct payload itself so
  // the units are assigned in the same transaction. Pre-seeded when arriving
  // from the product list's "scan barcode -> not found -> create product" flow.
  const initialBarcodes = route.params?.initialBarcode ? [normalizeBarcode(route.params.initialBarcode)] : [];
  const [pendingBarcodes, setPendingBarcodes] = useState<string[]>(initialBarcodes);
  // Synchronous source of truth for the duplicate check below — pendingBarcodes
  // (React state) only updates on the next render, so two tryAddBarcode calls
  // fired back-to-back (rapid double-scan, or a double-tap of "Add") can both
  // read the same stale array and both pass the check before either's state
  // update lands. ClaimSet is read/written in the same tick as the check (see
  // its own tests), so the second call always sees the first call's claim.
  const pendingBarcodesClaims = useRef(new ClaimSet<string>(initialBarcodes)).current;
  const [barcodeInput, setBarcodeInput] = useState('');
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState<string | null>(null);
  const [barcodeStatusTone, setBarcodeStatusTone] = useState<'success' | 'error'>('success');
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    listCategories(accessToken).then((res) => setCategories(res.data.filter((c) => c.isActive))).catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!initialProductId || !accessToken) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getProduct(accessToken, initialProductId);
        const p = res.data;
        setCategoryId(p.category.id);
        setSubcategoryId(p.subcategory.id);
        setChannelVisibility(p.channelVisibility);
        setTrackingMode(p.trackingMode);
        setIsActive(p.isActive);
        setImageUrl(p.images[0]?.url ?? null);
        setAvailableCount(p.availableCount);
        setSku(p.sku);
        setProductName(p.name);
        setIsFeatured(p.isFeatured);
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialProductId, accessToken]);

  // Reloads whenever the category changes, including on initial product load
  // (categoryId is set first, this effect then fetches that category's list).
  useEffect(() => {
    if (!accessToken || !categoryId) {
      setSubcategories([]);
      return;
    }
    setLoadingSubcategories(true);
    listSubcategories(accessToken, categoryId)
      .then((res) => setSubcategories(res.data.filter((s) => s.isActive)))
      .catch(() => setSubcategories([]))
      .finally(() => setLoadingSubcategories(false));
  }, [accessToken, categoryId]);

  const reloadPieces = useCallback(() => {
    if (!accessToken || !productId || trackingMode !== 'serialized') return;
    setLoadingPieces(true);
    listPieces(accessToken, productId)
      .then((res) => setPieces(res.data))
      .catch(() => setPieces([]))
      .finally(() => setLoadingPieces(false));
  }, [accessToken, productId, trackingMode]);

  useEffect(() => {
    reloadPieces();
  }, [reloadPieces]);

  // Re-checks availability/pieces whenever this screen regains focus — e.g.
  // navigating back from ReceiveStock after scanning in new units.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!accessToken || !productId) return;
      getProduct(accessToken, productId).then((res) => setAvailableCount(res.data.availableCount)).catch(() => {});
      reloadPieces();
    });
    return unsubscribe;
  }, [navigation, accessToken, productId, reloadPieces]);

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id);
    setSubcategoryId('');
    setCategoryPickerOpen(false);
    setSubcategoryPickerOpen(false);
  }, []);

  const handleSubcategorySelect = useCallback((id: string) => {
    setSubcategoryId(id);
    setSubcategoryPickerOpen(false);
  }, []);

  const buildPayload = useCallback(() => {
    // No name field: the backend always derives a new product's name from
    // its subcategory, and leaves an existing product's name untouched.
    // Attribute fields (technique/color/fabric/etc.) are no longer editable
    // here — omitting them is a no-op for an existing product (see
    // catalog.admin.service.ts's partial-update semantics) and leaves them
    // unset for a new one. trackingMode is still sent (just not
    // user-editable): 'serialized' by default for a new product, or an
    // existing product's already-loaded value, unchanged.
    return {
      categoryId,
      subcategoryId,
      channelVisibility,
      trackingMode,
      isFeatured,
      isActive,
    };
  }, [categoryId, subcategoryId, channelVisibility, trackingMode, isFeatured, isActive]);

  const tryAddBarcode = useCallback(
    async (rawCode: string) => {
      const code = normalizeBarcode(rawCode);
      if (!code || !accessToken) return;
      // claim() atomically checks-and-inserts, closing the window a second
      // overlapping call for this same code (rapid double-scan, or a
      // double-tap of "Add") could otherwise race through before the
      // scanLookup await below resolves.
      if (!pendingBarcodesClaims.claim(code)) {
        setBarcodeStatus(`Barcode already used — ${code} is already on this list`);
        setBarcodeStatusTone('error');
        return;
      }
      setCheckingBarcode(true);
      try {
        const res = await scanLookup(accessToken, code);
        // Genuinely already assigned elsewhere — release the speculative claim.
        pendingBarcodesClaims.release(code);
        setBarcodeStatus(`Barcode already used — on "${res.data.productName}" (${res.data.status})`);
        setBarcodeStatusTone('error');
      } catch {
        // scanLookup 404s when the code matches nothing yet — free to use.
        // The server re-checks for real inside the create transaction anyway,
        // so a false "free" here (a dropped call, say) is still caught there.
        setPendingBarcodes(pendingBarcodesClaims.toArray());
        setBarcodeStatus(`Added ${code}`);
        setBarcodeStatusTone('success');
      } finally {
        setCheckingBarcode(false);
      }
    },
    [accessToken, pendingBarcodesClaims]
  );

  const handleAddBarcode = () => {
    if (!barcodeInput.trim()) return;
    tryAddBarcode(barcodeInput);
    setBarcodeInput('');
  };

  // Closes the camera the moment a code is captured — one scan, then back
  // to the form — rather than staying open for continuous scanning.
  const handleCameraScanned = useCallback(
    (code: string) => {
      setScannerVisible(false);
      tryAddBarcode(code);
    },
    [tryAddBarcode]
  );

  const handleRemoveBarcode = (code: string) => {
    pendingBarcodesClaims.release(code);
    setPendingBarcodes((prev) => prev.filter((c) => c !== code));
  };

  const handleSave = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    if (!categoryId) return setError('Select a category');
    if (!subcategoryId) return setError('Select a subcategory');
    if (!isEdit) {
      // A new product must be sellable the moment it's created: a photo (the
      // only thing shown to customers) and at least one scanned/typed
      // barcode (its first real, physical unit) — otherwise it would list
      // instantly with no image and zero stock. Editing an existing product
      // skips this: it already has both from when it was created.
      if (!pendingImage) return setError('Add a photo before creating the product');
      if (pendingBarcodes.length === 0) return setError('Scan or add at least one barcode before creating the product');
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit && productId) {
        await updateProduct(accessToken, productId, payload);
        // The photo is a separate multipart upload, so it can only go after
        // the details save. A failure here keeps the staged photo on screen
        // so Save Changes can be tapped again — the live listing is left
        // exactly as it was.
        if (pendingImage) {
          setUploadingImage(true);
          try {
            const uploaded = await uploadProductImage(accessToken, productId, pendingImage);
            setImageUrl(uploaded.url);
            setPendingImage(null);
          } catch (uploadErr: any) {
            setError(
              `Details saved, but the photo failed to upload: ${uploadErr.message || 'unknown error'}. Tap Save Changes to retry.`
            );
            return;
          } finally {
            setUploadingImage(false);
          }
        }
        navigation.goBack();
        return;
      }

      // The scanned barcodes go out with the create call itself, so the
      // server assigns them in the same transaction that creates the product
      // — the product and its stock either both exist or neither does. A
      // separate follow-up call used to be skipped entirely whenever the
      // photo upload before it failed, listing the product at "0 in stock"
      // (Out of Stock on the customer site) despite staff having scanned real
      // units for it.
      const res = await createProduct(accessToken, { ...payload, barcodes: pendingBarcodes });
      const newProductId = res.data.id;
      setProductId(newProductId);
      setSku(res.data.sku);
      setProductName(res.data.name);
      setAvailableCount(res.data.availableCount);
      pendingBarcodesClaims.reset();
      setPendingBarcodes([]);

      // The photo is the one step that can't ride along in that transaction
      // (it's a separate multipart upload), so it stays best-effort: a failed
      // upload leaves a real, in-stock product to retry the photo on rather
      // than losing the whole entry.
      let warning = '';
      if (pendingImage) {
        try {
          const uploaded = await uploadProductImage(accessToken, newProductId, pendingImage);
          setImageUrl(uploaded.url);
        } catch (uploadErr: any) {
          warning = `Saved with its barcode(s), but the photo failed to upload: ${uploadErr.message || 'unknown error'}. Add it from this product's page.`;
        }
      }

      Alert.alert('Product created', warning || 'Its photo and scanned barcode(s) were saved.');
      // Land on the product's own page (same route the list and "scan ->
      // not found -> create" flow both use) instead of leaving staff on the
      // now-stale "New Product" form.
      navigation.replace('ProductForm', { productId: newProductId });
    } catch (err: any) {
      // A taken barcode rolls the whole creation back server-side, so the
      // form is still the live draft — drop just the offending codes so staff
      // can rescan those units and submit again, rather than re-entering
      // everything.
      if (err.code === 'BARCODE_ALREADY_ASSIGNED' && Array.isArray(err.details)) {
        const taken: string[] = err.details.map((d: any) => d.barcode);
        for (const code of taken) pendingBarcodesClaims.release(code);
        setPendingBarcodes(pendingBarcodesClaims.toArray());
        const onProduct = err.details[0]?.productName;
        setError(
          taken.length === 1
            ? `Barcode already used — ${taken[0]}${onProduct ? ` is on "${onProduct}"` : ''}. It was removed; scan a different unit.`
            : `Barcode already used — ${taken.length} codes belong to other units and were removed. Scan different units.`
        );
      } else {
        setError(err.message || 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  }, [accessToken, categoryId, subcategoryId, buildPayload, isEdit, productId, pendingImage, pendingBarcodes, navigation, pendingBarcodesClaims]);

  const processPickedPhoto = useCallback(
    async (uri: string) => {
      setError('');
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      const picked = { uri: compressed.uri, name: 'product.jpg', type: 'image/jpeg' };

      // Staged, never uploaded here — on an existing product the upload
      // REPLACES the live image (see catalog.admin.service.uploadProductImage),
      // which would put the new photo on the customer site before staff had
      // pressed Save Changes. It goes out in handleSave and nowhere else.
      setPendingImage(picked);
      setImageUrl(compressed.uri);
    },
    []
  );

  const handleChooseFromLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to add a product image');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await processPickedPhoto(result.assets[0].uri);
  }, [processPickedPhoto]);

  const handleTakePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to take a product photo');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await processPickedPhoto(result.assets[0].uri);
  }, [processPickedPhoto]);

  const handlePickImage = useCallback(() => setPhotoSheetVisible(true), []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </View>
    );
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedSubcategory = subcategories.find((s) => s.id === subcategoryId);

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={isEdit ? (productName || 'Edit Product') : 'New Product'}
          subtitle={sku ?? undefined}
        />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={styles.photoCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.photoThumb} />
        ) : (
          <View style={[styles.photoThumb, styles.photoThumbPlaceholder]}>
            <Ionicons name="image-outline" size={24} color={colors.iconMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.photoTitle}>Photo{!isEdit && <Text style={styles.required}> *</Text>}</Text>
          <Text style={styles.helper}>This photo is what shows on the customer website for this product.</Text>
          {pendingImage && (
            <Text style={styles.pendingPhotoHint}>
              {isEdit
                ? 'New photo ready — tap Save Changes to apply it.'
                : 'Photo ready — it uploads when you create the product below.'}
            </Text>
          )}
          <TouchableOpacity style={styles.replaceChip} onPress={handlePickImage} disabled={uploadingImage || saving}>
            <Text style={styles.replaceChipText}>{uploadingImage ? 'Uploading…' : imageUrl ? 'Replace' : 'Add photo'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.rowsCard}>
        <TouchableOpacity
          style={styles.pickerRow}
          onPress={() => setCategoryPickerOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerRowLabel}>Category <Text style={styles.required}>*</Text></Text>
          <Text style={styles.pickerRowValue} numberOfLines={1}>{selectedCategory?.name || 'Select'}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} style={{ marginLeft: spacing.xs + 2 }} />
        </TouchableOpacity>
        {categoryPickerOpen && (
          <SearchablePicker
            items={categories}
            selectedId={categoryId}
            onSelect={handleCategorySelect}
            searchPlaceholder="Search categories…"
            maxVisibleRows={5}
          />
        )}

        {!categoryId ? (
          <View style={[styles.pickerRow, styles.pickerRowLast]}>
            <Text style={styles.pickerRowLabel}>Subcategory</Text>
            <Text style={styles.helperInline}>Pick a category first</Text>
          </View>
        ) : loadingSubcategories ? (
          <View style={[styles.pickerRow, styles.pickerRowLast]}>
            <Text style={styles.pickerRowLabel}>Subcategory</Text>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : subcategories.length === 0 ? (
          <View style={[styles.pickerRow, styles.pickerRowLast]}>
            <Text style={styles.pickerRowLabel}>Subcategory</Text>
            <Text style={styles.helperInline} numberOfLines={1}>No subcategories yet</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.pickerRow, subcategoryPickerOpen && styles.pickerRowLast]}
              onPress={() => setSubcategoryPickerOpen((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerRowLabel}>Subcategory <Text style={styles.required}>*</Text></Text>
              <Text style={styles.pickerRowValue} numberOfLines={1}>{selectedSubcategory?.name || 'Select'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} style={{ marginLeft: spacing.xs + 2 }} />
            </TouchableOpacity>
            {subcategoryPickerOpen && (
              <SearchablePicker
                items={subcategories}
                selectedId={subcategoryId}
                onSelect={handleSubcategorySelect}
                searchPlaceholder="Search subcategories…"
                maxVisibleRows={6}
              />
            )}
          </>
        )}
      </Card>

      {selectedSubcategory && (
        <Text style={styles.noteText}>
          Price ₹{selectedSubcategory.onlinePrice} is set on the subcategory — change it in Categories.
        </Text>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.fieldLabel}>Best Seller</Text>
        <Switch value={isFeatured} onValueChange={setIsFeatured} trackColor={{ true: colors.primary }} />
      </View>

      <Text style={styles.sectionLabel}>Channel &amp; Stock</Text>
      <Card style={styles.card}>
        <Text style={styles.label}>Where does this product sell?</Text>
        <View style={styles.chipRow}>
          {VISIBILITY_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              active={channelVisibility === opt.value}
              onPress={() => setChannelVisibility(opt.value)}
            />
          ))}
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Barcodes{!isEdit && <Text style={styles.required}> *</Text>}</Text>
      {isEdit && productId ? (
        <Card style={styles.card}>
          <Text style={styles.helper}>{availableCount} in stock right now. Every physical unit is barcoded before it's received.</Text>
          <TouchableOpacity
            style={styles.receiveChip}
            onPress={() => navigation.navigate('ReceiveStock', { productId, productName: productName ?? sku ?? undefined, trackingMode })}
          >
            <Ionicons name="barcode-outline" size={15} color={colors.text} />
            <Text style={styles.receiveChipText}>Scan Barcode</Text>
          </TouchableOpacity>

          {trackingMode === 'serialized' && (
            <View style={{ marginTop: spacing.md }}>
              {loadingPieces ? (
                <ActivityIndicator color={colors.primary} />
              ) : pieces.length === 0 ? (
                <Text style={styles.helper}>No barcodes assigned yet.</Text>
              ) : (
                pieces.map((piece, index) => (
                  <View key={piece.id} style={[styles.pieceRow, index === pieces.length - 1 && styles.pickerRowLast]}>
                    <Text style={styles.pieceCode}>{piece.barcode}</Text>
                    <Text style={styles.helperInline}>{piece.status}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.helper}>Scan or add at least one unit now — required before the product can be created, and saved once you create it below.</Text>
          <View style={styles.manualBarcodeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              placeholder="Type a code, or tap the icon to scan"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              blurOnSubmit={false}
              onSubmitEditing={handleAddBarcode}
            />
            {/* The icon opens the camera directly — typing still works via the
                keyboard's return key (onSubmitEditing above) without a second button. */}
            <TouchableOpacity style={styles.addBarcodeButton} onPress={() => setScannerVisible(true)} activeOpacity={0.8}>
              <Ionicons name="barcode-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {checkingBarcode ? (
            <Text style={styles.helper}>Checking…</Text>
          ) : barcodeStatus ? (
            <View style={[styles.statusBanner, barcodeStatusTone === 'error' ? styles.statusBannerError : styles.statusBannerSuccess]}>
              <Ionicons
                name={barcodeStatusTone === 'error' ? 'alert-circle' : 'checkmark-circle'}
                size={15}
                color={barcodeStatusTone === 'error' ? colors.error : colors.success}
              />
              <Text style={[styles.statusBannerText, { color: barcodeStatusTone === 'error' ? colors.error : colors.success }]}>
                {barcodeStatus}
              </Text>
            </View>
          ) : null}

          {pendingBarcodes.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              {pendingBarcodes.map((code, index) => (
                <View key={code} style={[styles.pieceRow, index === pendingBarcodes.length - 1 && styles.pickerRowLast]}>
                  <Text style={styles.pieceCode}>{code}</Text>
                  <TouchableOpacity onPress={() => handleRemoveBarcode(code)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      <Button
        title={isEdit ? 'Save Changes' : 'Create Product'}
        onPress={handleSave}
        loading={saving}
        style={styles.saveButton}
      />

      <PhotoSourceSheet
        visible={photoSheetVisible}
        onTakePhoto={() => {
          setPhotoSheetVisible(false);
          handleTakePhoto();
        }}
        onChooseLibrary={() => {
          setPhotoSheetVisible(false);
          handleChooseFromLibrary();
        }}
        onClose={() => setPhotoSheetVisible(false)}
      />

      <BarcodeScanModal
        visible={scannerVisible}
        accessToken={accessToken}
        mode="assign"
        onScanned={handleCameraScanned}
        onClose={() => setScannerVisible(false)}
      />
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  card: { marginBottom: spacing.md },
  rowsCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionLabel: { ...typography.caption, color: colors.textLabel, marginBottom: spacing.sm + 2, marginTop: spacing.sm },
  label: { ...typography.bodySm, color: colors.textLabel, marginTop: spacing.md + 2, marginBottom: spacing.sm },
  helper: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xs, lineHeight: 16 },
  pendingPhotoHint: { fontSize: 12, color: colors.warning, fontWeight: '600', marginTop: spacing.xs },
  helperInline: { ...typography.bodySm, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  noteText: { ...typography.bodySm, color: colors.textLabel, marginBottom: spacing.lg, marginTop: -spacing.xs, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  pieceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pieceCode: { ...typography.bodySmSemibold, color: colors.text },
  receiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.md + 2,
  },
  receiveChipText: { ...typography.bodySmSemibold, color: colors.text },
  manualBarcodeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  addBarcodeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.md, padding: spacing.sm + 2, marginTop: spacing.sm,
  },
  statusBannerError: { backgroundColor: colors.errorBg },
  statusBannerSuccess: { backgroundColor: colors.successBg },
  statusBannerText: { ...typography.bodySmSemibold, flex: 1 },

  photoCard: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  photoThumb: { width: 86, height: 86, borderRadius: radius.md, backgroundColor: colors.placeholderBg },
  photoThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoTitle: { ...typography.bodySemibold, color: colors.text },
  replaceChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
    paddingVertical: spacing.xs + 4,
    paddingHorizontal: spacing.md + 2,
  },
  replaceChipText: { ...typography.bodySmSemibold, color: colors.text },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md - 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pickerRowLast: { borderBottomWidth: 0 },
  pickerRowLabel: { flex: 1, ...typography.bodySm, color: colors.textMuted },
  pickerRowValue: { ...typography.bodySemibold, color: colors.text, flexShrink: 1 },

  fieldLabel: { ...typography.bodySm, color: colors.textMuted },
  required: { color: colors.error },

  saveButton: { marginTop: spacing.md },
  error: {
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    fontSize: 13,
  },
});
