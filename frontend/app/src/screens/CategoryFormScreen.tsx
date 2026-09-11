import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listCategories, createCategory, updateCategory, uploadCategoryImage, AdminCategory } from '../api/catalog';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'CategoryForm'>;

export default function CategoryFormScreen({ route, navigation }: Props) {
  const categoryId = route.params?.categoryId;
  const isEdit = Boolean(categoryId);
  const { accessToken, role } = useAuth();
  const canEdit = role === 'ADMIN';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Held locally until Save Changes — see processPickedPhoto/handleSave.
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [subcategoryCount, setSubcategoryCount] = useState(0);

  useEffect(() => {
    if (!isEdit || !accessToken) return;
    (async () => {
      setLoading(true);
      try {
        const res = await listCategories(accessToken);
        const category = res.data.find((c: AdminCategory) => c.id === categoryId);
        if (!category) throw new Error('Category not found');
        setName(category.name);
        setDescription(category.description);
        setSortOrder(String(category.sortOrder));
        setImageUrl(category.imageUrl);
        setSubcategoryCount(category._count?.subcategories ?? 0);
      } catch (err: any) {
        setError(err.message || 'Failed to load category');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, categoryId, accessToken]);

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
        setPendingImage({ uri: compressed.uri, name: 'category.jpg', type: 'image/jpeg' });
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
      setError('Photo library permission is required to add a category image');
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
      setError('Camera permission is required to take a category photo');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await processPickedPhoto(result.assets[0].uri);
  }, [processPickedPhoto]);

  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const handlePickImage = useCallback(() => setPhotoSheetVisible(true), []);

  const handleSave = useCallback(async () => {
    if (!accessToken) return;
    setError('');

    if (name.trim().length < 2) return setError('Enter a category name');
    if (description.trim().length < 1) return setError('Enter a description');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        ...(sortOrder.trim() ? { sortOrder: Number(sortOrder) } : {}),
      };
      if (isEdit && categoryId) {
        await updateCategory(accessToken, categoryId, payload);
        // The staged photo is committed here, not when it was picked — one
        // "Save Changes" writes both the details and the image.
        if (pendingImage) {
          try {
            const uploaded = await uploadCategoryImage(accessToken, categoryId, pendingImage);
            setPendingImage(null);
            setImageUrl(uploaded.imageUrl);
          } catch (uploadErr: any) {
            // The text edits already saved — don't lose them over a failed
            // photo upload; keep the staged image so Save can be retried.
            setError(`Details saved, but the photo failed to upload: ${uploadErr.message || 'unknown error'}. Tap Save Changes to retry.`);
            setSaving(false);
            return;
          }
        }
      } else {
        await createCategory(accessToken, payload);
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }, [accessToken, name, description, sortOrder, isEdit, categoryId, navigation, pendingImage]);

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
        <ScreenHeader title={isEdit ? 'Edit Category' : 'New Category'} backLabel="Categories" />

      {!canEdit && (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.noticeText}>Only owners can edit categories. You can view details below.</Text>
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
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          editable={canEdit}
          placeholder="e.g. Handloom Pattu Saree"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <Text style={styles.helper}>A short blurb shown on the category page — pricing and per-item descriptions live on its subcategories.</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          editable={canEdit}
          multiline
          placeholder="Describe this category"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Display order</Text>
        <Text style={styles.helper}>Lower numbers show first on the homepage and storefront nav. Leave blank to keep its current position.</Text>
        <TextInput
          style={styles.input}
          value={sortOrder}
          onChangeText={setSortOrder}
          editable={canEdit}
          keyboardType="numeric"
          placeholder="e.g. 0"
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      {isEdit && canEdit && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Category Photo</Text>
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
              <Text style={styles.helper}>Shown on the "Shop by Category" grid and category page banner on the customer website.</Text>
              {pendingImage && <Text style={styles.pendingPhotoHint}>New photo ready — tap Save Changes to apply it.</Text>}
              <TouchableOpacity style={styles.imageButton} onPress={handlePickImage} disabled={uploadingImage}>
                <Text style={styles.imageButtonText}>{uploadingImage ? 'Preparing…' : imageUrl ? 'Replace Photo' : 'Add Photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      )}

      {isEdit && categoryId && (
        <TouchableOpacity onPress={() => navigation.navigate('SubcategoryList', { categoryId, categoryName: name })} activeOpacity={0.8}>
          <Card style={styles.linkCard}>
            <View style={styles.linkIconWrap}>
              <Ionicons name="albums-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Subcategories</Text>
              <Text style={styles.helper}>
                Price, description, and Hide/Unhide live here — {subcategoryCount} subcategor{subcategoryCount === 1 ? 'y' : 'ies'} so far.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} />
          </Card>
        </TouchableOpacity>
      )}

      {!isEdit && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
          <Text style={styles.infoCardText}>
            Once this category is created, you'll be able to add a photo and manage its subcategories — including
            pricing and visibility.
          </Text>
        </View>
      )}

      {canEdit && (
        <Button
          title={isEdit ? 'Save Changes' : 'Create Category'}
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
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  linkIconWrap: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { ...typography.bodySemibold, color: colors.text, marginBottom: 2 },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
  },
  infoCardText: { flex: 1, ...typography.bodySm, color: colors.textMuted, lineHeight: 18 },
  saveButton: { marginTop: spacing.xl },
});
