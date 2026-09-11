import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';

interface Props {
  visible: boolean;
  title?: string;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onClose: () => void;
}

// The app-wide photo picker — a frosted glass action sheet (blur + soft
// shadow), replacing the bare native Alert.alert used previously. Shared by
// every screen that adds a photo (products, categories, subcategories) so
// the picker looks and feels identical everywhere.
export default function PhotoSourceSheet({ visible, title, onTakePhoto, onChooseLibrary, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 95} tint="light" style={styles.sheet}>
          <View style={styles.sheen} />
          <View style={styles.handle} />
          <Text style={styles.title}>{title ?? 'Add Photo'}</Text>

          <TouchableOpacity style={styles.option} onPress={onTakePhoto} activeOpacity={0.7}>
            <View style={styles.iconWrap}>
              <Ionicons name="camera" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Take Photo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onChooseLibrary} activeOpacity={0.7}>
            <View style={styles.iconWrap}>
              <Ionicons name="images" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Choose from Library</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(43, 37, 35, 0.4)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
  },
  sheet: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 97, 94, 0.35)',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(122, 31, 43, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  cancelButton: {
    marginTop: 4,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});
