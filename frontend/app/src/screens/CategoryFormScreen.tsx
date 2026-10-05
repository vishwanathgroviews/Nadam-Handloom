import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listCategories, createCategory, updateCategory, uploadCategoryImage, listSubcategories, AdminCategory, AdminSubcategory } from '../api/catalog';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import ScreenHeader from '../components/ui/ScreenHeader';
import { parseSortOrder } from '../utils/sortOrder';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

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
  const [isHidden, setIsHidden] = useState(false);
  const [isOfferActive, setIsOfferActive] = useState(false);
  const [subcategories, setSubcategories] = useState<AdminSubcategory[]>([]);
  const [offerSubcategoryIds, setOfferSubcategoryIds] = useState<string[]>([]);
  // Held locally until Save Changes — see processPickedPhoto/handleSave.
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [subcategoryCount, setSubcategoryCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAllSelected = subcategories.length > 0 && offerSubcategoryIds.length === subcategories.length;
  const isNoneSelected = offerSubcategoryIds.length === 0;
  const isSpecificSelected = !isAllSelected && !isNoneSelected;

  const filteredSubcategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subcategories;
    return subcategories.filter((s) => s.name.toLowerCase().includes(q));
  }, [subcategories, searchQuery]);

  const getDropdownSubtitle = useCallback(() => {
    if (isAllSelected) {
      return `Special Offer badge applies to all ${subcategories.length} subcategories`;
    }
    if (isNoneSelected) {
      return 'No subcategories have Special Offer badge';
    }
    const selectedNames = subcategories
      .filter((s) => offerSubcategoryIds.includes(s.id))
      .map((s) => s.name);
    if (selectedNames.length <= 2) {
      return selectedNames.join(', ');
    }
    return `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} more`;
  }, [isAllSelected, isNoneSelected, subcategories, offerSubcategoryIds]);

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
        setIsHidden(category.isHidden ?? !category.isActive);
        setIsOfferActive(Boolean(category.isOfferActive));
        setSubcategoryCount(category._count?.subcategories ?? 0);

        if (categoryId) {
          try {
            const subRes = await listSubcategories(accessToken, categoryId);
            setSubcategories(subRes.data);
            const initialOffers = subRes.data
              .filter((s: AdminSubcategory) => Boolean(s.isOfferActive))
              .map((s: AdminSubcategory) => s.id);
            setOfferSubcategoryIds(initialOffers);
          } catch {
            // non-fatal
          }
        }
      } catch (err: any) {
        setError(err.message || 'Could not open this category. Please try again.');
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
        setError(err.message || 'Could not use this picture. Please try another one.');
      } finally {
        setUploadingImage(false);
      }
    },
    []
  );

  const handleChooseFromLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Please allow access to your photos to add a picture');
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
      setError('Please allow camera access to take a picture');
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

  const handleToggleSubcategoryOffer = useCallback((subId: string) => {
    setOfferSubcategoryIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  }, []);

  const handleSelectAllSubcategoryOffers = useCallback(() => {
    setOfferSubcategoryIds(subcategories.map((s) => s.id));
  }, [subcategories]);

  const handleClearAllSubcategoryOffers = useCallback(() => {
    setOfferSubcategoryIds([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!accessToken) return;
    setError('');

    if (name.trim().length < 2) return setError('Please enter a name');
    if (description.trim().length < 1) return setError('Please enter a short description');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        ...(parseSortOrder(sortOrder) !== undefined ? { sortOrder: parseSortOrder(sortOrder) } : {}),
        isActive: !isHidden,
        isHidden,
        isOfferActive,
        ...(isEdit && subcategories.length > 0 ? { subcategoryOfferIds: offerSubcategoryIds } : {}),
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
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [accessToken, name, description, sortOrder, isHidden, isOfferActive, isEdit, categoryId, navigation, pendingImage, subcategories, offerSubcategoryIds]);

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
          <Text style={styles.noticeText}>Only the owner can make changes here. You can still see the details.</Text>
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
        <Text style={styles.helper}>A few words about this category. Customers see this on the website.</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          editable={canEdit}
          multiline
          placeholder="Write a few words about this category"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Position</Text>
        <Text style={styles.helper}>1 shows first on the website, 2 shows second, and so on. If another category already has this number, the two swap places. Leave empty to keep it where it is.</Text>
        <TextInput
          style={styles.input}
          value={sortOrder}
          onChangeText={setSortOrder}
          editable={canEdit}
          keyboardType="numeric"
          placeholder="e.g. 1"
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      {isEdit && canEdit && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Picture</Text>
          <View style={styles.imageSection}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            ) : (
              <View style={[styles.imagePreview, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={26} color={colors.iconMuted} />
                <Text style={styles.imagePlaceholderText}>No picture yet</Text>
              </View>
            )}
            <View style={styles.imageSectionActions}>
              <Text style={styles.helper}>Customers see this picture on the website.</Text>
              {pendingImage && <Text style={styles.pendingPhotoHint}>New picture added. Tap Save to keep it.</Text>}
              <TouchableOpacity style={styles.imageButton} onPress={handlePickImage} disabled={uploadingImage}>
                <Text style={styles.imageButtonText}>{uploadingImage ? 'Preparing…' : imageUrl ? 'Change Picture' : 'Add Photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      )}

      <Text style={styles.sectionLabel}>Promotions &amp; Offers</Text>
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={styles.fieldLabelInline}>Category Special Offer Badge</Text>
            <Text style={styles.helper}>
              Display a Special Offer badge on this category across the website.
            </Text>
          </View>
          <Switch
            value={isOfferActive}
            onValueChange={setIsOfferActive}
            disabled={!canEdit}
            trackColor={{ true: colors.primary }}
          />
        </View>

        {isEdit && subcategories.length > 0 && (
          <View style={styles.subOffersSection}>
            <Text style={styles.fieldLabelInline}>Subcategories with Special Offer</Text>
            <Text style={styles.helper}>
              Choose which subcategories should receive the Special Offer badge, or apply to all.
            </Text>

            <TouchableOpacity
              style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerActive]}
              onPress={() => setDropdownOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownTriggerLeft}>
                <View
                  style={[
                    styles.dropdownIconWrap,
                    (isAllSelected || isSpecificSelected) && styles.dropdownIconWrapActive,
                  ]}
                >
                  <Ionicons
                    name={isAllSelected ? 'sparkles' : isSpecificSelected ? 'checkbox' : 'remove-circle-outline'}
                    size={18}
                    color={isAllSelected || isSpecificSelected ? colors.primary : colors.iconMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownTriggerTitle}>
                    {isAllSelected
                      ? `All Subcategories (${subcategories.length})`
                      : isSpecificSelected
                      ? `${offerSubcategoryIds.length} of ${subcategories.length} Selected`
                      : 'None (0 selected)'}
                  </Text>
                  <Text style={styles.dropdownTriggerSub} numberOfLines={1}>
                    {getDropdownSubtitle()}
                  </Text>
                </View>
              </View>
              <View style={styles.dropdownChevronWrap}>
                <Ionicons
                  name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={styles.dropdownPanel}>
                <View style={styles.presetOptions}>
                  <TouchableOpacity
                    style={[styles.presetOption, isAllSelected && styles.presetOptionActive]}
                    onPress={() => canEdit && handleSelectAllSubcategoryOffers()}
                    activeOpacity={canEdit ? 0.7 : 1}
                  >
                    <View style={[styles.presetRadio, isAllSelected && styles.presetRadioActive]}>
                      {isAllSelected && <View style={styles.presetRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.presetTitle, isAllSelected && styles.presetTitleActive]}>
                        All Subcategories ({subcategories.length})
                      </Text>
                      <Text style={styles.presetDesc}>Apply Special Offer badge to all subcategories</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetOption, isSpecificSelected && styles.presetOptionActive]}
                    onPress={() => {}}
                    activeOpacity={1}
                  >
                    <View style={[styles.presetRadio, isSpecificSelected && styles.presetRadioActive]}>
                      {isSpecificSelected && <View style={styles.presetRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.presetTitle, isSpecificSelected && styles.presetTitleActive]}>
                        Specific Subcategories {offerSubcategoryIds.length > 0 ? `(${offerSubcategoryIds.length})` : ''}
                      </Text>
                      <Text style={styles.presetDesc}>Select individual subcategories from the list below</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetOption, isNoneSelected && styles.presetOptionActive]}
                    onPress={() => canEdit && handleClearAllSubcategoryOffers()}
                    activeOpacity={canEdit ? 0.7 : 1}
                  >
                    <View style={[styles.presetRadio, isNoneSelected && styles.presetRadioActive]}>
                      {isNoneSelected && <View style={styles.presetRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.presetTitle, isNoneSelected && styles.presetTitleActive]}>
                        None
                      </Text>
                      <Text style={styles.presetDesc}>Remove Special Offer from all subcategories</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.checklistSection}>
                  <View style={styles.searchRow}>
                    <Ionicons name="search" size={15} color={colors.textMuted} />
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search subcategories…"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      editable={canEdit}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.checklistHeader}>
                    <Text style={styles.checklistSummary}>
                      {offerSubcategoryIds.length} of {subcategories.length} selected
                    </Text>
                    {canEdit && (
                      <View style={styles.checklistActions}>
                        <TouchableOpacity onPress={handleSelectAllSubcategoryOffers} hitSlop={6}>
                          <Text style={styles.actionLink}>Select All</Text>
                        </TouchableOpacity>
                        <Text style={styles.actionDivider}>·</Text>
                        <TouchableOpacity onPress={handleClearAllSubcategoryOffers} hitSlop={6}>
                          <Text style={styles.actionLink}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <ScrollView
                    style={styles.subListScroll}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredSubcategories.length === 0 ? (
                      <View style={styles.emptySearchWrap}>
                        <Text style={styles.emptySearchText}>No subcategories match "{searchQuery}"</Text>
                      </View>
                    ) : (
                      filteredSubcategories.map((sub) => {
                        const isSelected = offerSubcategoryIds.includes(sub.id);
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            style={[styles.subRow, isSelected && styles.subRowSelected]}
                            onPress={() => canEdit && handleToggleSubcategoryOffer(sub.id)}
                            activeOpacity={canEdit ? 0.7 : 1}
                          >
                            <View style={{ flex: 1, paddingRight: spacing.sm }}>
                              <Text style={[styles.subName, isSelected && styles.subNameSelected]}>
                                {sub.name}
                              </Text>
                              <Text style={styles.subPrice}>
                                {sub.mrp && Number(sub.mrp) > Number(sub.onlinePrice) ? `MRP ₹${sub.mrp} · ` : ''}₹{sub.onlinePrice} selling · ₹{sub.storePrice} store
                              </Text>
                            </View>
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setDropdownOpen(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </Card>

      <Text style={styles.sectionLabel}>Catalog Visibility</Text>
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={styles.fieldLabelInline}>Hide from Catalog</Text>
            <Text style={styles.helper}>
              Hidden categories and their subcategories do not appear on the website.
            </Text>
          </View>
          <Switch
            value={isHidden}
            onValueChange={setIsHidden}
            disabled={!canEdit}
            trackColor={{ true: colors.warning }}
          />
        </View>
      </Card>

      {isEdit && categoryId && (
        <TouchableOpacity onPress={() => navigation.navigate('SubcategoryList', { categoryId, categoryName: name })} activeOpacity={0.8}>
          <Card style={styles.linkCard}>
            <View style={styles.linkIconWrap}>
              <Ionicons name="albums-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Subcategories</Text>
              <Text style={styles.helper}>
                Set prices, descriptions and what shows on the website — {subcategoryCount} subcategor{subcategoryCount === 1 ? 'y' : 'ies'} now.
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
          title={isEdit ? 'Save' : 'Add Category'}
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
  sectionLabel: { ...typography.caption, color: colors.textLabel, marginTop: spacing.xl, marginBottom: spacing.xs, textTransform: 'uppercase' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  fieldLabelInline: { ...typography.bodySemibold, color: colors.text },
  subOffersSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dropdownTriggerActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
    paddingRight: spacing.sm,
  },
  dropdownIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIconWrapActive: {
    backgroundColor: '#FFFFFF',
  },
  dropdownTriggerTitle: {
    ...typography.bodySemibold,
    color: colors.text,
  },
  dropdownTriggerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  dropdownChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownPanel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  presetOptions: {
    gap: spacing.xs,
  },
  presetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
  },
  presetOptionActive: {
    backgroundColor: colors.primaryBg,
  },
  presetRadio: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.iconMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRadioActive: {
    borderColor: colors.primary,
  },
  presetRadioDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  presetTitle: {
    ...typography.bodySmSemibold,
    color: colors.text,
  },
  presetTitleActive: {
    color: colors.primary,
  },
  presetDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  checklistSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: 'Outfit_500Medium',
    paddingVertical: 2,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  checklistSummary: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Outfit_500Medium',
  },
  checklistActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  actionDivider: {
    fontSize: 12,
    color: colors.iconMuted,
  },
  subListScroll: {
    maxHeight: 240,
    marginTop: spacing.xs,
  },
  emptySearchWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    marginBottom: spacing.xs,
  },
  subRowSelected: {
    backgroundColor: colors.primaryBg,
  },
  subName: {
    ...typography.bodySmSemibold,
    color: colors.text,
  },
  subNameSelected: {
    color: colors.primary,
  },
  subPrice: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  doneBtn: {
    marginTop: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    ...typography.bodySmSemibold,
    color: '#FFFFFF',
  },
  saveButton: { marginTop: spacing.xl },
});
