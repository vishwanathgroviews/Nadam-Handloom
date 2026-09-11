import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listSubcategories, createSubcategory, updateSubcategory, uploadSubcategoryImage, AdminSubcategory } from '../api/catalog';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'SubcategoryForm'>;

export default function SubcategoryFormScreen({ route, navigation }: Props) {
  const { categoryId, subcategoryId } = route.params;
  const isEdit = Boolean(subcategoryId);
  const { accessToken, role } = useAuth();
  const canEdit = role === 'ADMIN';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [onlinePrice, setOnlinePrice] = useState('');
  const [storePrice, setStorePrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasOwnImage, setHasOwnImage] = useState(false);
  // Held locally until Save Changes — see processPickedPhoto/handleSave.
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);

  useEffect(() => {
    if (!isEdit || !accessToken) return;
    (async () => {
      setLoading(true);
      try {
        const res = await listSubcategories(accessToken, categoryId);
        const subcategory = res.data.find((s: AdminSubcategory) => s.id === subcategoryId);
        if (!subcategory) throw new Error('Subcategory not found');
        setName(subcategory.name);
        setDescription(subcategory.description);
        setOnlinePrice(String(subcategory.onlinePrice));
        setStorePrice(String(subcategory.storePrice));
        setIsActive(subcategory.isActive);
        setImageUrl(subcategory.imageUrl);
        setHasOwnImage(subcategory.hasOwnImage);
      } catch (err: any) {
        setError(err.message || 'Failed to load subcategory');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, categoryId, subcategoryId, accessToken]);

  // Staged, not uploaded: picking a photo only swaps the local preview and
  // remembers the file — nothing reaches the server until Save Changes runs
  // handleSave below. Backing out of the screen therefore discards it, the
  // same as any other unsaved edit on this form.
  const processPickedPhoto = useCallback(
    async (uri: string) => {
      setUploadingImage(true);
      setError('');
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setPendingImage({ uri: compressed.uri, name: 'subcategory.jpg', type: 'image/jpeg' });
        setImageUrl(compressed.uri);
      } catch (err: any) {
        setError(err.message || 'Failed to prepare the image');
      } finally {
        setUploadingImage(false);
      }
    },
    []
  );

  const handleChooseFromLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to add a subcategory image');
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
      setError('Camera permission is required to take a subcategory photo');
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

  const handleSave = useCallback(async () => {
    if (!accessToken) return;
    setError('');

    if (name.trim().length < 2) return setError('Enter a subcategory name');
    if (description.trim().length < 1) return setError('Enter a description');
    const online = Number(onlinePrice);
    const store = Number(storePrice);
    if (!online || online <= 0) return setError('Enter a valid online price');
    if (!store || store <= 0) return setError('Enter a valid store price');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        onlinePrice: online,
        storePrice: store,
      };
      if (isEdit && subcategoryId) {
        await updateSubcategory(accessToken, subcategoryId, { ...payload, isActive });
        // The staged photo is committed here, not when it was picked — one
        // "Save Changes" writes both the details and the image.
        if (pendingImage) {
          try {
            const uploaded = await uploadSubcategoryImage(accessToken, subcategoryId, pendingImage);
            setPendingImage(null);
            setImageUrl(uploaded.imageUrl);
            setHasOwnImage(true);
          } catch (uploadErr: any) {
            // The text/price edits already saved — don't lose them over a
            // failed photo upload; keep the staged image so Save can retry.
            setError(`Details saved, but the photo failed to upload: ${uploadErr.message || 'unknown error'}. Tap Save Changes to retry.`);
            setSaving(false);
            return;
          }
        }
      } else {
        await createSubcategory(accessToken, categoryId, payload);
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Failed to save subcategory');
    } finally {
      setSaving(false);
    }
  }, [accessToken, name, description, onlinePrice, storePrice, isActive, isEdit, categoryId, subcategoryId, navigation, pendingImage]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={isEdit ? 'Edit Subcategory' : 'New Subcategory'} backLabel="Subcategories" />

      {!canEdit && (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.noticeText}>Only owners can edit subcategory pricing. You can view details below.</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>

        <Text style={styles.fieldLabel}>Name</Text>
        <Text style={styles.helper}>Matches the item name customers filter by, e.g. "Double Zari lines".</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          editable={canEdit}
          placeholder="e.g. Double Zari lines"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <Text style={styles.helper}>Shown on every product in this subcategory.</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          editable={canEdit}
          multiline
          placeholder="Describe this subcategory of products"
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Pricing</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.fieldLabel}>Online Price (₹)</Text>
            <TextInput
              style={styles.input}
              value={onlinePrice}
              onChangeText={setOnlinePrice}
              editable={canEdit}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.fieldLabel}>Store Price (₹)</Text>
            <TextInput
              style={styles.input}
              value={storePrice}
              onChangeText={setStorePrice}
              editable={canEdit}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
        <Text style={styles.helper}>
          Online price shows on the customer web and is what Razorpay charges. Store price only appears in this app
          when staff scan a tag.
        </Text>
      </Card>

      {isEdit && canEdit && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Subcategory Photo</Text>
          <View style={styles.imageSection}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            ) : (
              <View style={[styles.imagePreview, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={26} color={colors.iconMuted} />
                <Text style={styles.imagePlaceholderText}>No photo yet</Text>
              </View>
            )}
            <View style={styles.imageSectionActions}>
              <Text style={styles.helper}>
                {imageUrl && !hasOwnImage
                  ? 'Shown on the customer website — currently a photo from one of its products, since this subcategory has no photo of its own yet. Add one below to use a specific photo instead.'
                  : 'Shown on the category page and product listings for this subcategory on the customer website.'}
              </Text>
              {pendingImage && <Text style={styles.pendingPhotoHint}>New photo ready — tap Save Changes to apply it.</Text>}
              <TouchableOpacity style={styles.imageButton} onPress={handlePickImage} disabled={uploadingImage}>
                <Text style={styles.imageButtonText}>{uploadingImage ? 'Preparing…' : imageUrl ? 'Change Photo' : 'Add Photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      )}

      {isEdit && (
        <Card style={[styles.card, styles.switchRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabelInline}>Visible on customer web</Text>
            <Text style={styles.helper}>Turn off to hide just this subcategory — and its products — from the website. The category and its other subcategories stay visible.</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            disabled={!canEdit}
            trackColor={{ false: colors.divider, true: colors.primary }}
            thumbColor="#fff"
          />
        </Card>
      )}

      {canEdit && (
        <Button
          title={isEdit ? 'Update Price & Details' : 'Create Subcategory'}
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      )}

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
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.xl },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.warningBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  noticeText: { ...typography.bodySm, color: colors.warning, flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
  card: { marginTop: spacing.lg },
  cardTitle: { ...typography.caption, color: colors.textLabel, marginBottom: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textLabel, marginTop: spacing.lg, marginBottom: spacing.sm },
  fieldLabelInline: { ...typography.bodySemibold, color: colors.text, marginBottom: spacing.xs },
  helper: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginBottom: spacing.sm },
  pendingPhotoHint: { fontSize: 12, color: colors.warning, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    fontFamily: 'Outfit_500Medium',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  imageSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  imagePreview: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.placeholderBg },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  imagePlaceholderText: { fontSize: 11, color: colors.textMuted },
  imageSectionActions: { flex: 1, gap: spacing.sm },
  imageButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  imageButtonText: { ...typography.bodySmSemibold, color: colors.text },
  saveButton: { marginTop: spacing.xl },
});
